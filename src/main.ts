import { App, Notice, ObsidianProtocolData, Plugin } from "obsidian";
import { shell } from "electron";
import * as nodePath from "path";
import * as nodeFs   from "fs";
import { ENSSettings, ENSSettingTab, RootDef } from "./settings";

// ── Narrowing helpers for untyped persisted data ──────────────────────────────

type LocalPaths = Record<string, string>;

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function asNonEmptyString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

/** Keep only the string-valued entries of an arbitrary object. */
function toLocalPaths(value: unknown): LocalPaths {
  const record = asRecord(value);
  if (!record) return {};
  const paths: LocalPaths = {};
  for (const [prefix, path] of Object.entries(record)) {
    if (typeof path === "string") paths[prefix] = path;
  }
  return paths;
}

// ── Device-local path storage ─────────────────────────────────────────────────
// Folder paths are per device and must never sync, so they live in Obsidian's
// vault-scoped local storage rather than in data.json.

const LOCAL_PATHS_KEY = "ens-local-paths";

function loadLocalPaths(app: App): LocalPaths {
  return toLocalPaths(app.loadLocalStorage(LOCAL_PATHS_KEY));
}

function saveLocalPaths(app: App, paths: LocalPaths): void {
  app.saveLocalStorage(LOCAL_PATHS_KEY, paths);
}

/**
 * Before 1.0 the paths were written straight to `localStorage` under a key
 * suffixed with the vault name. Obsidian's own helpers are already vault
 * scoped, so the legacy key is read once, migrated, and removed. Without this
 * an upgrading user would silently lose every configured folder path.
 */
function migrateLegacyLocalPaths(app: App): LocalPaths | null {
  const legacyKey = `ens-local-paths-${app.vault.getName()}`;
  try {
    const raw = window.localStorage.getItem(legacyKey);
    if (!raw) return null;
    const paths = toLocalPaths(JSON.parse(raw));
    window.localStorage.removeItem(legacyKey);
    return paths;
  } catch {
    return null;
  }
}

// ── Resolver ──────────────────────────────────────────────────────────────────

/**
 * Why a link could not be opened. Carried so the click handler can tell the
 * user what went wrong instead of doing nothing.
 */
type Resolution =
  | { ok: true;  path: string }
  | { ok: false; reason: "malformed" }
  | { ok: false; reason: "unknown-prefix" | "no-path" | "outside-root"; prefix: string }
  | { ok: false; reason: "missing"; path: string };

function describeFailure(result: Extract<Resolution, { ok: false }>): string {
  switch (result.reason) {
    case "malformed":
      return "Malformed link. Expected the form prefix:path.";
    case "unknown-prefix":
      return `No namespace registered for "${result.prefix}". Add it in the External Namespaces settings.`;
    case "no-path":
      return `No folder path set for "${result.prefix}" on this device. Add it in the External Namespaces settings.`;
    case "outside-root":
      return `Link resolves outside the "${result.prefix}" folder, so it was not opened.`;
    case "missing":
      return `File not found: ${result.path}`;
  }
}

class Resolver {
  constructor(private settings: ENSSettings) {}

  private findRoot(prefix: string): RootDef | undefined {
    return this.settings.roots.find(r => r.prefix === prefix && r.prefix && r.path);
  }

  /**
   * Relative paths to try, percent-decoded form first.
   * Obsidian may or may not have decoded the query parameter already, and a
   * filename can legitimately contain a "%", so both forms are considered.
   */
  private candidates(rel: string): string[] {
    const list = [rel];
    try {
      const decoded = decodeURIComponent(rel);
      if (decoded !== rel) list.unshift(decoded);
    } catch {
      // Malformed escape sequence — the raw form is the only sensible reading.
    }
    return list;
  }

  /**
   * Absolute path for `rel` beneath `rootPath`, or null if it escapes.
   * Every candidate passes through here *after* decoding, so an encoded
   * traversal such as %2e%2e%2f cannot slip past the containment check.
   */
  private contain(rootPath: string, rel: string): string | null {
    if (nodePath.isAbsolute(rel) || /^[A-Za-z]:/.test(rel)) return null;

    const rootAbs  = nodePath.resolve(rootPath);
    const resolved = nodePath.resolve(rootAbs, rel);

    // The result must be the root itself or a descendant of it.
    const offset = nodePath.relative(rootAbs, resolved);
    if (offset !== "" && (offset.startsWith("..") || nodePath.isAbsolute(offset))) return null;

    return resolved;
  }

  /**
   * Convert "prefix:relative/path" → absolute filesystem path.
   * Returns null if the path would resolve outside the registered root, so a
   * crafted link cannot use ".." to reach arbitrary files on the device.
   */
  resolve(namespacedPath: string): Resolution {
    const idx = namespacedPath.indexOf(":");
    if (idx === -1) return { ok: false, reason: "malformed" };
    const prefix = namespacedPath.slice(0, idx);
    const rel    = namespacedPath.slice(idx + 1);

    const root = this.findRoot(prefix);
    if (!root) {
      // A prefix that exists but has no path is the common cross-device case:
      // the link synced across, the folder location has not been set here yet.
      const known = this.settings.roots.some(r => r.prefix === prefix && r.prefix);
      return known
        ? { ok: false, reason: "no-path",        prefix }
        : { ok: false, reason: "unknown-prefix", prefix };
    }

    let firstContained: string | null = null;
    let escaped        = false;
    for (const candidate of this.candidates(rel)) {
      const abs = this.contain(root.path, candidate);
      if (!abs) { escaped = true; continue; }                // escapes the root — discard
      if (nodeFs.existsSync(abs)) return { ok: true, path: abs };
      if (firstContained === null) firstContained = abs;
    }

    // If any reading of the path climbed out of the root and nothing openable
    // was found, the escape is the useful thing to report. Otherwise the raw
    // form of an encoded "../" gets described as a missing file, which hides
    // what actually happened.
    if (escaped || firstContained === null) return { ok: false, reason: "outside-root", prefix };
    return { ok: false, reason: "missing", path: firstContained };
  }

  /** Open the resolved path with its default OS application. */
  open(namespacedPath: string): void {
    const result = this.resolve(namespacedPath);
    if (!result.ok) {
      new Notice(describeFailure(result));
      return;
    }
    void shell.openPath(result.path).then(error => {
      // openPath resolves with a non-empty string when the OS refused it,
      // for example when no application is associated with the file type.
      if (error) new Notice(`Could not open ${result.path}: ${error}`);
    });
  }
}

// ── Paste handler ─────────────────────────────────────────────────────────────

/**
 * If the pasted text is a Windows absolute path that falls under a registered
 * root, replace the selection with an obsidian://ens link and return true.
 */
function handlePaste(
  editor: { replaceSelection: (s: string) => void },
  rawText: string,
  settings: ENSSettings
): boolean {
  const text = rawText.replace(/^"+|"+$/g, "").trim();
  if (!/^[A-Za-z]:[\\/]/.test(text)) return false;

  const norm = text.replace(/\\/g, "/");

  // Find the longest matching root.
  let bestRoot:    { def: RootDef; normPath: string } | null = null;
  let bestRootLen = 0;

  for (const r of settings.roots) {
    if (!r.prefix || !r.path) continue;
    const rootNorm = r.path.replace(/\\/g, "/").replace(/\/+$/, "");
    if (norm === rootNorm || norm.startsWith(rootNorm + "/")) {
      if (rootNorm.length > bestRootLen) {
        bestRootLen = rootNorm.length;
        bestRoot    = { def: r, normPath: rootNorm };
      }
    }
  }

  if (!bestRoot) return false;

  const rel      = norm.slice(bestRoot.normPath.length).replace(/^\/+/, "");
  const filename = rel.split("/").at(-1) ?? rel;

  // Percent-encode each segment so spaces, "&", "#" and friends survive both
  // Markdown link parsing and the query string. Separators stay literal.
  const encoded = rel.split("/").map(encodeURIComponent).join("/");
  const link    = `[${filename}](obsidian://ens?p=${bestRoot.def.prefix}:${encoded})`;

  editor.replaceSelection(link);
  return true;
}

// ── Plugin ────────────────────────────────────────────────────────────────────

export default class ENSPlugin extends Plugin {
  settings!: ENSSettings;
  resolver!: Resolver;
  settingsTab!: ENSSettingTab;

  async onload() {
    await this.loadSettings();
    this.resolver = new Resolver(this.settings);

    // Route obsidian://ens?p=prefix:path to shell.openPath().
    this.registerObsidianProtocolHandler("ens", (params: ObsidianProtocolData) => {
      const p = params["p"];
      if (p) this.resolver.open(p);
    });

    // Convert pasted Windows paths into namespace links.
    this.registerEvent(
      this.app.workspace.on("editor-paste", (evt: ClipboardEvent, editor) => {
        if (evt.defaultPrevented) return;
        const text = (evt.clipboardData?.getData("text") ?? "").trim();
        if (!text) return;
        if (handlePaste(editor, text, this.settings)) evt.preventDefault();
      })
    );

    this.settingsTab = new ENSSettingTab(this.app, this);
    this.addSettingTab(this.settingsTab);
  }

  onunload() {}

  async loadSettings() {
    const data = asRecord(await this.loadData());

    let needsSave = false;

    // Paths written by pre-1.0 versions live under a different key.
    let localPaths = loadLocalPaths(this.app);
    if (Object.keys(localPaths).length === 0) {
      const legacy = migrateLegacyLocalPaths(this.app);
      if (legacy) {
        localPaths = legacy;
        needsSave  = true;
      }
    }

    // ── Build synced prefix list ──────────────────────────────────────────────
    const syncedRoots: RootDef[] = [];
    if (Array.isArray(data?.roots)) {
      for (const entry of data.roots) {
        const record = asRecord(entry);
        const prefix = record && asNonEmptyString(record.prefix);
        if (!record || !prefix) continue;
        syncedRoots.push({ prefix, path: asNonEmptyString(record.path) ?? "" });
      }
    }

    const has = (prefix: string) => syncedRoots.some(r => r.prefix === prefix);

    // ── Migrate from old formats ──────────────────────────────────────────────
    // A root in data.json that still carries a path moves to local storage.
    for (const r of syncedRoots) {
      if (r.path && !localPaths[r.prefix]) {
        localPaths[r.prefix] = r.path;
        needsSave = true;
      }
    }

    if (data) {
      // Legacy named-field format (dropboxEnabled, onedrivePersonalEnabled, …).
      const namedRoots: Array<[string, unknown, unknown]> = [
        ["dropbox",      data.dropboxEnabled,          data.dropboxPath],
        ["onedrive",     data.onedrivePersonalEnabled, data.onedrivePersonalPath],
        ["onedrivecuny", data.onedriveCunyEnabled,     data.onedriveCunyPath],
      ];
      for (const [prefix, enabled, rawPath] of namedRoots) {
        const path = asNonEmptyString(rawPath);
        if (!enabled || !path || has(prefix)) continue;
        syncedRoots.push({ prefix, path: "" });
        if (!localPaths[prefix]) localPaths[prefix] = path;
        needsSave = true;
      }

      if (Array.isArray(data.customRoots)) {
        for (const entry of data.customRoots) {
          const record = asRecord(entry);
          if (!record?.enabled) continue;
          const prefix = asNonEmptyString(record.prefix);
          const path   = asNonEmptyString(record.path);
          if (!prefix || !path || has(prefix)) continue;
          syncedRoots.push({ prefix, path: "" });
          if (!localPaths[prefix]) localPaths[prefix] = path;
          needsSave = true;
        }
      }
    }

    if (needsSave) saveLocalPaths(this.app, localPaths);

    // ── Merge: combine prefix list with local paths ───────────────────────────
    this.settings = {
      roots: syncedRoots.map(r => ({
        prefix: r.prefix,
        path:   localPaths[r.prefix] ?? "",
      }))
    };

    if (needsSave) await this.saveSettings();
  }

  async saveSettings() {
    // Paths → local storage only (device-local, never synced)
    const localPaths: LocalPaths = {};
    for (const r of this.settings.roots) {
      if (r.prefix) localPaths[r.prefix] = r.path;
    }
    saveLocalPaths(this.app, localPaths);

    // Prefixes only → data.json (synced across devices)
    await this.saveData({
      roots: this.settings.roots
        .filter(r => r.prefix)
        .map(r => ({ prefix: r.prefix }))
    });

    this.resolver = new Resolver(this.settings);
  }
}
