import * as fs from "fs";
import * as path from "path";
import { Notice, normalizePath } from "obsidian";
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

  async rebuild(): Promise<void> {
    this.index = [];

    const roots = this.registry.getEnabled();
    for (const root of roots) {
      await this.scanRoot(root);
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

  private async scanRoot(root: RootDefinition): Promise<void> {
    const rootPath = normalizePath(root.path);

    try {
      await fs.promises.access(rootPath);
    } catch {
      new Notice(
        `External Namespaces: Cannot access root "${root.prefix}" at ${root.path}`
      );
      return;
    }

    await this.walk(root, rootPath, "", 0);
  }

  private async walk(
    root: RootDefinition,
    absolutePath: string,
    relativePath: string,
    depth: number
  ): Promise<void> {
    if (depth > this.maxDepth) return;

    let entries: fs.Dirent[];
    try {
      entries = await fs.promises.readdir(absolutePath, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      const abs = path.join(absolutePath, entry.name);
      const rel = relativePath
        ? `${relativePath}/${entry.name}`
        : entry.name;

      if (entry.isDirectory()) {
        await this.walk(root, abs, rel, depth + 1);
      } else {
        this.index.push({
          prefix: root.prefix,
          relativePath: normalizePath(rel)
        });
      }
    }
  }
}
