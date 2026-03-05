import { App, PluginSettingTab, Setting } from "obsidian";

/* -----------------------------
   Types
------------------------------ */

export interface CustomRoot {
  enabled: boolean;
  prefix: string;
  path: string;
}

export interface ExternalNamespacesSettings {
  onedrivePersonalPath: string;
  onedrivePersonalEnabled: boolean;

  onedriveCunyPath: string;
  onedriveCunyEnabled: boolean;

  dropboxPath: string;
  dropboxEnabled: boolean;

  customRoots: CustomRoot[];
}

/* -----------------------------
   Defaults
------------------------------ */

export const DEFAULT_SETTINGS: ExternalNamespacesSettings = {
  onedrivePersonalPath: "",
  onedrivePersonalEnabled: false,

  onedriveCunyPath: "",
  onedriveCunyEnabled: false,

  dropboxPath: "",
  dropboxEnabled: false,

  customRoots: []
};

/* -----------------------------
   Settings Tab
------------------------------ */

export class ExternalNamespacesSettingTab extends PluginSettingTab {
  plugin: {
    settings: ExternalNamespacesSettings;
    saveSettings: () => Promise<void>;
  };

  constructor(app: App, plugin: { settings: ExternalNamespacesSettings; saveSettings: () => Promise<void> }) {
    super(app, plugin as never);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl("h2", {
      text: "External Namespaces — Filesystem Roots"
    });

    /* -----------------------------
       Built-in Providers
    ------------------------------ */

    containerEl.createEl("h3", { text: "Built-in Providers" });

    new Setting(containerEl)
      .setName("OneDrive (Personal)")
      .setDesc("Local path to your personal OneDrive folder")
      .addText(text =>
        text
          .setPlaceholder("C:\\Users\\USERNAME\\OneDrive")
          .setValue(this.plugin.settings.onedrivePersonalPath)
          .onChange(async value => {
            this.plugin.settings.onedrivePersonalPath = value;
            await this.plugin.saveSettings();
          })
      )
      .addToggle(toggle =>
        toggle
          .setValue(this.plugin.settings.onedrivePersonalEnabled)
          .onChange(async value => {
            this.plugin.settings.onedrivePersonalEnabled = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("OneDrive (CUNY / Corporate)")
      .setDesc("Local path to your corporate or institutional OneDrive folder")
      .addText(text =>
        text
          .setPlaceholder("C:\\Users\\USERNAME\\OneDrive - CUNY")
          .setValue(this.plugin.settings.onedriveCunyPath)
          .onChange(async value => {
            this.plugin.settings.onedriveCunyPath = value;
            await this.plugin.saveSettings();
          })
      )
      .addToggle(toggle =>
        toggle
          .setValue(this.plugin.settings.onedriveCunyEnabled)
          .onChange(async value => {
            this.plugin.settings.onedriveCunyEnabled = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Dropbox")
      .setDesc("Local path to your Dropbox folder")
      .addText(text =>
        text
          .setPlaceholder("C:\\Users\\USERNAME\\Dropbox")
          .setValue(this.plugin.settings.dropboxPath)
          .onChange(async value => {
            this.plugin.settings.dropboxPath = value;
            await this.plugin.saveSettings();
          })
      )
      .addToggle(toggle =>
        toggle
          .setValue(this.plugin.settings.dropboxEnabled)
          .onChange(async value => {
            this.plugin.settings.dropboxEnabled = value;
            await this.plugin.saveSettings();
          })
      );

    /* -----------------------------
       Custom Roots
    ------------------------------ */

    containerEl.createEl("h3", { text: "Custom Roots" });

    this.plugin.settings.customRoots.forEach((root, index) => {
      new Setting(containerEl)
        .setName(`Custom Root: ${root.prefix || "(unnamed)"}`)
        .setDesc("User-defined filesystem root")
        .addText(text =>
          text
            .setPlaceholder("prefix")
            .setValue(root.prefix)
            .onChange(async value => {
              this.plugin.settings.customRoots[index].prefix = value;
              await this.plugin.saveSettings();
            })
        )
        .addText(text =>
          text
            .setPlaceholder("C:\\path\\to\\folder")
            .setValue(root.path)
            .onChange(async value => {
              this.plugin.settings.customRoots[index].path = value;
              await this.plugin.saveSettings();
            })
        )
        .addToggle(toggle =>
          toggle
            .setValue(root.enabled)
            .onChange(async value => {
              this.plugin.settings.customRoots[index].enabled = value;
              await this.plugin.saveSettings();
            })
        )
        .addButton(button =>
          button
            .setButtonText("Delete")
            .setWarning()
            .onClick(async () => {
              this.plugin.settings.customRoots.splice(index, 1);
              await this.plugin.saveSettings();
              this.display();
            })
        );
    });

    new Setting(containerEl)
      .setName("Add Custom Root")
      .setDesc("Add a new user-defined filesystem root")
      .addButton(button =>
        button
          .setButtonText("Add Root")
          .setCta()
          .onClick(async () => {
            this.plugin.settings.customRoots.push({
              prefix: "",
              path: "",
              enabled: false
            });
            await this.plugin.saveSettings();
            this.display();
          })
      );
  }
}
