import { RootRegistry } from "../roots/RootRegistry";
import { RootDefinition } from "../roots/RootDefinition";
import * as path from "path";
import * as fs from "fs";

export class FileSystemResolver {
  private registry: RootRegistry;

  constructor(registry: RootRegistry) {
    this.registry = registry;
  }

  /**
   * Resolve a namespaced path of the form:
   *   prefix:relative/path
   * into an absolute filesystem path.
   */
  resolve(namespacedPath: string): string | null {
    const parsed = this.parse(namespacedPath);
    if (!parsed) return null;

    const { root, relativePath } = parsed;

    const fullPath = path.join(root.path, relativePath);
    return path.normalize(fullPath);
  }

  /**
   * Open a namespaced path in the OS.
   * Files open with their default application.
   * Folders open in the system file explorer.
   */
  open(namespacedPath: string): void {
    const resolved = this.resolve(namespacedPath);
    if (!resolved) return;

    if (!fs.existsSync(resolved)) {
      console.warn("External Namespaces: path does not exist", resolved);
      return;
    }

    // Obsidian provides this utility globally
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).require("electron").shell.openPath(resolved);
  }

  /**
   * Parse prefix and relative path.
   */
  private parse(
    namespacedPath: string
  ): { root: RootDefinition; relativePath: string } | null {
    const idx = namespacedPath.indexOf(":");
    if (idx === -1) return null;

    const prefix = namespacedPath.slice(0, idx);
    const relativePath = namespacedPath.slice(idx + 1);

    const root = this.registry.getByPrefix(prefix);
    if (!root) return null;

    return { root, relativePath };
  }
}
