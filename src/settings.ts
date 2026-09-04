import { App, PluginSettingTab } from "obsidian";
import ENSPlugin from "./main";

// ── Data types ────────────────────────────────────────────────────────────────

export interface RootDef {
  prefix: string;  // short label used in links, e.g. "dropbox"
  path:   string;  // absolute Windows path, e.g. "D:\\Dropbox"
}

export interface ENSSettings {
  roots: RootDef[];
}

// ── Settings tab ──────────────────────────────────────────────────────────────

export class ENSSettingTab extends PluginSettingTab {
  plugin: ENSPlugin;

  constructor(app: App, plugin: ENSPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const plugin = this.plugin;
    const el     = this.containerEl;
    el.empty();

    el.createEl("p", {
      cls:  "ens-desc",
      text: "Map short prefixes to folders on your computer. " +
            "Paste any Windows file path from a registered folder into a note " +
            "and it becomes a clickable link automatically."
    });

    el.createEl("p", {
      cls:  "ens-sync-notice",
      text: "Folder paths are stored on this device only and will not sync to other devices."
    });

    // ── Roots table ──────────────────────────────────────────────────────────
    const table = el.createDiv({ cls: "ens-table" });

    table.createSpan({ cls: "ens-th", text: "Prefix" });
    table.createSpan({ cls: "ens-th", text: "Folder path" });
    table.createSpan({ cls: "ens-th" });

    const roots = plugin.settings.roots;

    if (roots.length === 0) {
      table.createSpan({
        cls:  "ens-empty",
        text: "No roots configured. Add one below."
      });
    } else {
      roots.forEach((root, i) => {
        const prefixInput       = table.createEl("input", { cls: "ens-input" });
        prefixInput.type        = "text";
        prefixInput.placeholder = "Prefix";
        prefixInput.value       = root.prefix;
        prefixInput.addEventListener("change", () => {
          plugin.settings.roots[i].prefix = prefixInput.value.trim().toLowerCase();
          void plugin.saveSettings();
        });

        const pathInput       = table.createEl("input", { cls: "ens-input" });
        pathInput.type        = "text";
        pathInput.placeholder = "Path on this device";
        pathInput.value       = root.path;
        pathInput.addEventListener("change", () => {
          plugin.settings.roots[i].path = pathInput.value.trim();
          void plugin.saveSettings();
        });

        const del = table.createEl("button", { cls: "ens-delete-btn", text: "✕" });
        del.setAttribute("aria-label", "Remove root");
        del.addEventListener("click", () => {
          plugin.settings.roots.splice(i, 1);
          void plugin.saveSettings();
          this.display();
        });
      });
    }

    // ── Add root button ──────────────────────────────────────────────────────
    const addRow = el.createDiv({ cls: "ens-add-row" });
    const addBtn = addRow.createEl("button", { cls: "mod-cta", text: "Add root" });
    addBtn.addEventListener("click", () => {
      plugin.settings.roots.push({ prefix: "", path: "" });
      void plugin.saveSettings();
      this.display();
    });

    // ── Usage hint ───────────────────────────────────────────────────────────
    if (roots.length > 0) {
      const exPrefix = roots[0].prefix || "prefix";
      const hint     = el.createEl("p", { cls: "ens-hint" });
      hint.appendText(
        "Paste any Windows path from a registered folder into a note — " +
        "it becomes a link like "
      );
      hint.createEl("code", {
        text: `[filename](obsidian://ens?p=${exPrefix}:relative/path)`
      });
      hint.appendText(
        ". In reading or preview mode only the filename is visible; " +
        "clicking it opens the file."
      );
    }
  }
}
