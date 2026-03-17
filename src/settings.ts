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

export const DEFAULT_SETTINGS: ENSSettings = {
  roots: []
};

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

    el.createEl("h2", { text: "External Namespaces" });

    el.createEl("p", {
      cls:  "ens-desc",
      text: "Map short prefixes to folders on your computer. " +
            "Paste any Windows file path from a registered folder into a note " +
            "and it becomes a clickable link automatically."
    });

    // ── Roots table ──────────────────────────────────────────────────────────
    const table = el.createDiv({ cls: "ens-table" });

    table.createEl("span", { cls: "ens-th", text: "Prefix" });
    table.createEl("span", { cls: "ens-th", text: "Folder path" });
    table.createEl("span", { cls: "ens-th" });

    const roots = plugin.settings.roots;

    if (roots.length === 0) {
      table.createEl("span", {
        cls:  "ens-empty",
        text: "No roots configured. Add one below."
      });
    } else {
      roots.forEach((root, i) => {
        const prefixInput       = table.createEl("input", { cls: "ens-input" }) as HTMLInputElement;
        prefixInput.type        = "text";
        prefixInput.placeholder = "prefix";
        prefixInput.value       = root.prefix;
        prefixInput.addEventListener("change", async () => {
          plugin.settings.roots[i].prefix = prefixInput.value.trim().toLowerCase();
          await plugin.saveSettings();
        });

        const pathInput       = table.createEl("input", { cls: "ens-input" }) as HTMLInputElement;
        pathInput.type        = "text";
        pathInput.placeholder = "C:\\path\\to\\folder";
        pathInput.value       = root.path;
        pathInput.addEventListener("change", async () => {
          plugin.settings.roots[i].path = pathInput.value.trim();
          await plugin.saveSettings();
        });

        const del = table.createEl("button", { cls: "ens-delete-btn" });
        del.textContent = "✕";
        del.setAttribute("aria-label", "Remove root");
        del.addEventListener("click", async () => {
          plugin.settings.roots.splice(i, 1);
          await plugin.saveSettings();
          this.display();
        });
      });
    }

    // ── Add root button ──────────────────────────────────────────────────────
    const addRow = el.createDiv({ cls: "ens-add-row" });
    const addBtn = addRow.createEl("button", { cls: "mod-cta" });
    addBtn.textContent = "+ Add root";
    addBtn.addEventListener("click", async () => {
      plugin.settings.roots.push({ prefix: "", path: "" });
      await plugin.saveSettings();
      this.display();
    });

    // ── Usage hint ───────────────────────────────────────────────────────────
    if (roots.length > 0) {
      const exPrefix = roots[0].prefix || "prefix";
      const hint     = el.createEl("p", { cls: "ens-hint" });
      hint.innerHTML =
        "Paste any Windows path from a registered folder into a note — " +
        "it becomes a link like <code>[filename](obsidian://ens?p=" +
        exPrefix + ":relative/path)</code>. " +
        "In reading or preview mode only the filename is visible; clicking it opens the file.";
    }
  }
}
