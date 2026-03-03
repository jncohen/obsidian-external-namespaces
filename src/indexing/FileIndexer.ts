import * as fs from "fs";
import * as path from "path";
import { normalizePath } from "obsidian";
import { RootRegistry } from "../roots/RootRegistry";
import { RootDefinition } from "../roots/RootDefinition";

export interface IndexedPath {
  prefix: string;
  relativePath: string;
}

export class FileIndexer {
  private registry: RootRegistry;
  private maxDepth: number;
  private index: IndexedPath[] = [];

  constructor(registry: RootRegistry, maxDepth = 6) {
    this.registry = registry;
    this.maxDepth = maxDepth;
  }

  rebuild() {
    this.index = [];

    const roots = this.registry.getEnabled();
    for (const root of roots) {
      this.scanRoot(root);
    }
  }

  getAll(): IndexedPath[] {
    return this.index;
  }

  search(prefix: string, query: string): IndexedPath[] {
    return this.index.filter(
      entry =>
        entry.prefix === prefix &&
        entry.relativePath.toLowerCase().includes(query.toLowerCase())
    );
  }

  private scanRoot(root: RootDefinition) {
    const rootPath = normalizePath(root.path);
    if (!fs.existsSync(rootPath)) return;

    this.walk(root, rootPath, "", 0);
  }

  private walk(
    root: RootDefinition,
    absolutePath: string,
    relativePath: string,
    depth: number
  ) {
    if (depth > this.maxDepth) return;

    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(absolutePath, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      const abs = path.join(absolutePath, entry.name);
      const rel = relativePath
        ? `${relativePath}/${entry.name}`
        : entry.name;

      if (entry.isDirectory()) {
        this.walk(root, abs, rel, depth + 1);
      } else {
        this.index.push({
          prefix: root.prefix,
          relativePath: normalizePath(rel)
        });
      }
    }
  }
}
