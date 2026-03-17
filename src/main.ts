import { ObsidianProtocolData, Plugin } from "obsidian";
import * as nodePath from "path";
import * as nodeFs   from "fs";
import { ENSSettings, DEFAULT_SETTINGS, ENSSettingTab, RootDef } from "./settings";

// ── Resolver ──────────────────────────────────────────────────────────────────

class Resolver {
  constructor(private settings: ENSSettings) {}

  private findRoot(prefix: string): RootDef | undefined {
    return this.settings.roots.find(r => r.prefix === prefix && r.prefix && r.path);
  }

  /** Convert "prefix:relative/path" → absolute filesystem path. */
  resolve(namespacedPath: string): string | null {
    const idx = namespacedPath.indexOf(":");
    if (idx === -1) return null;
    const prefix = namespacedPath.slice(0, idx);
    const rel    = namespacedPath.slice(idx + 1);
    const root   = this.findRoot(prefix);
    if (!root) return null;
    return nodePath.normalize(nodePath.join(root.path, rel));
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
  const link     = `[${filename}](obsidian://ens?p=${bestRoot.def.prefix}:${rel})`;

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
    const data = await this.loadData() as any;
    this.settings = Object.assign({}, DEFAULT_SETTINGS, data ?? {});
    if (!Array.isArray(this.settings.roots)) this.settings.roots = [];

    // ── Migrate from old format ───────────────────────────────────────────────
    if (data) {
      const existing = this.settings.roots;
      const has = (prefix: string) => existing.some(r => r.prefix === prefix);

      if (data.dropboxEnabled         && data.dropboxPath         && !has("dropbox"))
        existing.push({ prefix: "dropbox",       path: data.dropboxPath });
      if (data.onedrivePersonalEnabled && data.onedrivePersonalPath && !has("onedrive"))
        existing.push({ prefix: "onedrive",      path: data.onedrivePersonalPath });
      if (data.onedriveCunyEnabled     && data.onedriveCunyPath     && !has("onedrivecuny"))
        existing.push({ prefix: "onedrivecuny",  path: data.onedriveCunyPath });

      if (Array.isArray(data.customRoots)) {
        for (const r of data.customRoots) {
          if (r.enabled && r.prefix && r.path && !has(r.prefix))
            existing.push({ prefix: r.prefix, path: r.path });
        }
      }
    }
  }

  async saveSettings() {
    await this.saveData(this.settings);
    this.resolver = new Resolver(this.settings);
  }
}
