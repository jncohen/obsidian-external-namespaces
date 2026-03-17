"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = void 0;

var obsidian = require("obsidian");
var nodePath  = require("path");
var nodeFs    = require("fs");

// ── Default settings ──────────────────────────────────────────────────────────

var DEFAULT_SETTINGS = { roots: [] };

// ── Settings tab ──────────────────────────────────────────────────────────────

class ENSSettingTab extends obsidian.PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display() {
    var plugin = this.plugin;
    var el = this.containerEl;
    el.empty();

    el.createEl("h2", { text: "External Namespaces" });

    el.createEl("p", {
      cls: "ens-desc",
      text:
        "Map short prefixes to folders on your computer. " +
        "Paste any Windows file path from a registered folder into a note " +
        "and it becomes a clickable link automatically."
    });

    // Grid table
    var table = el.createDiv({ cls: "ens-table" });

    // Header row
    table.createEl("span", { cls: "ens-th", text: "Prefix" });
    table.createEl("span", { cls: "ens-th", text: "Folder path" });
    table.createEl("span", { cls: "ens-th" }); // delete column header (blank)

    var roots = plugin.settings.roots;

    if (roots.length === 0) {
      table.createEl("span", {
        cls: "ens-empty",
        text: "No roots configured. Add one below."
      });
    } else {
      roots.forEach(function (root, i) {
        // Prefix input
        var prefixInput = table.createEl("input", { cls: "ens-input" });
        prefixInput.type        = "text";
        prefixInput.placeholder = "prefix";
        prefixInput.value       = root.prefix;
        prefixInput.addEventListener("change", async function () {
          plugin.settings.roots[i].prefix = prefixInput.value.trim().toLowerCase();
          await plugin.saveSettings();
        });

        // Path input
        var pathInput = table.createEl("input", { cls: "ens-input" });
        pathInput.type        = "text";
        pathInput.placeholder = "C:\\path\\to\\folder";
        pathInput.value       = root.path;
        pathInput.addEventListener("change", async function () {
          plugin.settings.roots[i].path = pathInput.value.trim();
          await plugin.saveSettings();
        });

        // Delete button
        var del = table.createEl("button", { cls: "ens-delete-btn" });
        del.textContent = "✕";
        del.setAttribute("aria-label", "Remove root");
        del.addEventListener("click", async function () {
          plugin.settings.roots.splice(i, 1);
          await plugin.saveSettings();
          plugin.settingsTab.display();
        });
      });
    }

    // "Add root" button
    var addRow = el.createDiv({ cls: "ens-add-row" });
    var addBtn = addRow.createEl("button", { cls: "mod-cta" });
    addBtn.textContent = "+ Add root";
    addBtn.addEventListener("click", async function () {
      plugin.settings.roots.push({ prefix: "", path: "" });
      await plugin.saveSettings();
      plugin.settingsTab.display();
    });

    // Usage hint (shown once at least one root exists)
    if (roots.length > 0) {
      var exPrefix = roots[0].prefix || "prefix";
      var hint = el.createEl("p", { cls: "ens-hint" });
      hint.innerHTML =
        "Paste any Windows path from a registered folder into a note — " +
        "it becomes a link like <code>[filename](obsidian://ens?p=" +
        exPrefix + ":relative/path)</code>. " +
        "In reading or preview mode only the filename is visible; clicking it opens the file.";
    }
  }
}

// ── Resolver ──────────────────────────────────────────────────────────────────

class Resolver {
  constructor(settings) {
    this.settings = settings;
  }

  // Find the best-matching root for a prefix string.
  findRoot(prefix) {
    return this.settings.roots.find(function (r) {
      return r.prefix === prefix && r.prefix && r.path;
    }) || null;
  }

  // Convert "prefix:relative/path" → absolute filesystem path.
  resolve(namespacedPath) {
    var idx = namespacedPath.indexOf(":");
    if (idx === -1) return null;
    var prefix = namespacedPath.slice(0, idx);
    var rel    = namespacedPath.slice(idx + 1);
    var root   = this.findRoot(prefix);
    if (!root) return null;
    return nodePath.normalize(nodePath.join(root.path, rel));
  }

  // Open the file/folder with its default OS application.
  open(namespacedPath) {
    var resolved = this.resolve(namespacedPath);
    if (!resolved) return;
    if (!nodeFs.existsSync(resolved)) return;
    window.require("electron").shell.openPath(resolved);
  }
}

// ── Paste handler ─────────────────────────────────────────────────────────────

// Converts a pasted Windows absolute path into an obsidian://ens link if it
// falls under a registered root.  Returns true if the paste was handled.
function handlePaste(editor, rawText, settings) {
  var text = rawText.replace(/^"+|"+$/g, "").trim();
  if (!/^[A-Za-z]:[\\/]/.test(text)) return false;

  // Normalise to forward slashes for consistent prefix matching.
  var norm = text.replace(/\\/g, "/");

  // Find the longest matching root (so nested roots beat shallower ones).
  var bestRoot    = null;
  var bestRootLen = 0;
  for (var i = 0; i < settings.roots.length; i++) {
    var r = settings.roots[i];
    if (!r.prefix || !r.path) continue;
    var rootNorm = r.path.replace(/\\/g, "/").replace(/\/+$/, "");
    if (norm === rootNorm || norm.startsWith(rootNorm + "/")) {
      if (rootNorm.length > bestRootLen) {
        bestRootLen = rootNorm.length;
        bestRoot    = { def: r, normPath: rootNorm };
      }
    }
  }

  if (!bestRoot) return false;

  var rel      = norm.slice(bestRoot.normPath.length).replace(/^\/+/, "");
  var parts    = rel.split("/");
  var filename = parts[parts.length - 1] || rel;
  var link     = "[" + filename + "](obsidian://ens?p=" + bestRoot.def.prefix + ":" + rel + ")";

  editor.replaceSelection(link);
  return true;
}

// ── Plugin ────────────────────────────────────────────────────────────────────

class ENSPlugin extends obsidian.Plugin {
  async onload() {
    await this.loadSettings();
    this.resolver = new Resolver(this.settings);

    // Route obsidian://ens?p=prefix:path to shell.openPath().
    // This runs entirely inside Obsidian — no Windows protocol registration
    // required, no "Open link" dialog, no "Get an app" error.
    this.registerObsidianProtocolHandler("ens", (params) => {
      var p = params["p"];
      if (p) this.resolver.open(p);
    });

    // Convert pasted Windows paths into namespace links.
    this.registerEvent(
      this.app.workspace.on("editor-paste", (evt, editor) => {
        var text = ((evt.clipboardData && evt.clipboardData.getData("text")) || "").trim();
        if (!text) return;
        if (handlePaste(editor, text, this.settings)) evt.preventDefault();
      })
    );

    this.settingsTab = new ENSSettingTab(this.app, this);
    this.addSettingTab(this.settingsTab);
  }

  onunload() {}

  async loadSettings() {
    var data = await this.loadData();
    this.settings = Object.assign({}, DEFAULT_SETTINGS, data || {});
    if (!Array.isArray(this.settings.roots)) this.settings.roots = [];

    // ── Migrate from old plugin format ──────────────────────────────────────
    // The previous version stored built-in providers (Dropbox, OneDrive) as
    // separate top-level keys and custom roots as a "customRoots" array.
    // Import them into the new unified "roots" array on first load.
    if (data) {
      var existing = this.settings.roots;
      var has = function (prefix) {
        return existing.some(function (r) { return r.prefix === prefix; });
      };

      if (data.dropboxEnabled && data.dropboxPath && !has("dropbox"))
        existing.push({ prefix: "dropbox", path: data.dropboxPath });

      if (data.onedrivePersonalEnabled && data.onedrivePersonalPath && !has("onedrive"))
        existing.push({ prefix: "onedrive", path: data.onedrivePersonalPath });

      if (data.onedriveCunyEnabled && data.onedriveCunyPath && !has("onedrivecuny"))
        existing.push({ prefix: "onedrivecuny", path: data.onedriveCunyPath });

      if (Array.isArray(data.customRoots)) {
        data.customRoots.forEach(function (r) {
          if (r.enabled && r.prefix && r.path && !has(r.prefix))
            existing.push({ prefix: r.prefix, path: r.path });
        });
      }
    }
  }

  async saveSettings() {
    await this.saveData(this.settings);
    this.resolver = new Resolver(this.settings);
  }
}

exports.default = ENSPlugin;
