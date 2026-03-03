import { ExternalNamespacesSettings } from "../settings";
import { RootDefinition } from "./RootDefinition";

export class RootRegistry {
  private roots: RootDefinition[] = [];

  constructor(settings: ExternalNamespacesSettings) {
    this.roots = this.buildRoots(settings);
  }

  private buildRoots(settings: ExternalNamespacesSettings): RootDefinition[] {
    const roots: RootDefinition[] = [];

    if (settings.onedrivePersonalEnabled && settings.onedrivePersonalPath) {
      roots.push({
        prefix: "onedrive",
        path: settings.onedrivePersonalPath,
        enabled: true,
        source: "builtin"
      });
    }

    if (settings.onedriveCunyEnabled && settings.onedriveCunyPath) {
      roots.push({
        prefix: "onedrivecuny",
        path: settings.onedriveCunyPath,
        enabled: true,
        source: "builtin"
      });
    }

    if (settings.dropboxEnabled && settings.dropboxPath) {
      roots.push({
        prefix: "dropbox",
        path: settings.dropboxPath,
        enabled: true,
        source: "builtin"
      });
    }

    settings.customRoots.forEach(root => {
      if (!root.enabled || !root.prefix || !root.path) return;

      roots.push({
        prefix: root.prefix,
        path: root.path,
        enabled: true,
        source: "custom"
      });
    });

    return roots;
  }

  getAll(): RootDefinition[] {
    return [...this.roots];
  }

  getEnabled(): RootDefinition[] {
    return this.roots.filter(r => r.enabled);
  }

  has(prefix: string): boolean {
    return this.roots.some(r => r.prefix === prefix && r.enabled);
  }


  getByPrefix(prefix: string): RootDefinition | undefined {
    return this.roots.find(r => r.prefix === prefix && r.enabled);
  }
}
