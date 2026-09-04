import { ObsidianProtocolData, Plugin } from "obsidian";
import * as nodePath from "path";
import * as nodeFs   from "fs";
import { ENSSettings, DEFAULT_SETTINGS, ENSSettingTab, RootDef } from "./settings";

// ── Device-local path storage (localStorage) ──────────────────────────────────

function localStorageKey(vaultName: string): string {
  return `ens-local-paths-${vaultName}`;
}

function loadLocalPaths(vaultName: string): Record<string, string> {
  try {
    const raw = localStorage.getItem(localStorageKey(vaultName));
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

function saveLocalPaths(vaultName: string, paths: Record<string, string>): void {
  localStorage.setItem(localStorageKey(vaultName), JSON.stringify(paths));
}

// ── Resolver ──────────────────────────────────────────────────────────────────

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
  resolve(namespacedPath: string): string | null {
    const idx = namespacedPath.indexOf(":");
    if (idx === -1) return null;
    const prefix = namespacedPath.slice(0, idx);
    const rel    = namespacedPath.slice(idx + 1);
    const root   = this.findRoot(prefix);
    if (!root) return null;

    let firstContained: string | null = null;
    for (const candidate of this.candidates(rel)) {
      const abs = this.contain(root.path, candidate);
      if (!abs) continue;                       // escapes the root — discard
      if (nodeFs.existsSync(abs)) return abs;   // prefer one that actually exists
      if (firstContained === null) firstContained = abs;
    }
    return firstContained;
  }

  /** Open the resolved path with its default OS application. */
  open(namespacedPath: string): void {
    const resolved = this.resolve(namespacedPath);
    if (!resolved) return;
    if (!nodeFs.existsSync(resolved)) return;
    (window as any).require("electron").shell.openPath(resolved);
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
    const data       = await this.loadData() as any;
    const vaultName  = this.app.vault.getName();
    const localPaths = loadLocalPaths(vaultName);

    // ── Build synced prefix list ──────────────────────────────────────────────
    let syncedRoots: Array<{ prefix: string; path: string }> = [];
    if (data && Array.isArray(data.roots)) {
      syncedRoots = (data.roots as any[]).filter(r => typeof r.prefix === "string" && r.prefix);
    }

    // ── Migrate from old format ───────────────────────────────────────────────
    // Handles: roots[].path still present in data.json, and legacy named fields.
    let needsSave = false;
    const has = (prefix: string) => syncedRoots.some(r => r.prefix === prefix);

    // If any root in data.json has a path, migrate it to localStorage and strip it.
    for (const r of syncedRoots) {
      if (r.path && !localPaths[r.prefix]) {
        localPaths[r.prefix] = r.path;
        needsSave = true;
      }
    }

    // Legacy named-field format (dropboxEnabled, onedrivePersonalEnabled, etc.)
    if (data) {
      if (data.dropboxEnabled         && data.dropboxPath         && !has("dropbox")) {
        syncedRoots.push({ prefix: "dropbox",      path: "" });
        if (!localPaths["dropbox"]) localPaths["dropbox"] = data.dropboxPath;
        needsSave = true;
      }
      if (data.onedrivePersonalEnabled && data.onedrivePersonalPath && !has("onedrive")) {
        syncedRoots.push({ prefix: "onedrive",     path: "" });
        if (!localPaths["onedrive"]) localPaths["onedrive"] = data.onedrivePersonalPath;
        needsSave = true;
      }
      if (data.onedriveCunyEnabled     && data.onedriveCunyPath     && !has("onedrivecuny")) {
        syncedRoots.push({ prefix: "onedrivecuny", path: "" });
        if (!localPaths["onedrivecuny"]) localPaths["onedrivecuny"] = data.onedriveCunyPath;
        needsSave = true;
      }
      if (Array.isArray(data.customRoots)) {
        for (const r of data.customRoots) {
          if (r.enabled && r.prefix && r.path && !has(r.prefix)) {
            syncedRoots.push({ prefix: r.prefix, path: "" });
            if (!localPaths[r.prefix]) localPaths[r.prefix] = r.path;
            needsSave = true;
          }
        }
      }
    }

    if (needsSave) saveLocalPaths(vaultName, localPaths);

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
    const vaultName = this.app.vault.getName();

    // Paths → localStorage only (device-local, never synced)
    const localPaths: Record<string, string> = {};
    for (const r of this.settings.roots) {
      if (r.prefix) localPaths[r.prefix] = r.path;
    }
    saveLocalPaths(vaultName, localPaths);

    // Prefixes only → data.json (synced across devices)
    await this.saveData({
      roots: this.settings.roots
        .filter(r => r.prefix)
        .map(r => ({ prefix: r.prefix }))
    });

    this.resolver = new Resolver(this.settings);
  }
}
