import { Editor, normalizePath } from "obsidian";
import { RootRegistry } from "../roots/RootRegistry";
import * as path from "path";

/**
 * Intercepts pasted text and rewrites Windows filesystem paths
 * into namespaced links when they fall under an enabled root.
 */
export function normalizePaste(
  editor: Editor,
  text: string,
  registry: RootRegistry
): boolean {
  // Strip surrounding quotes from “Copy as path”
  const cleaned = text.replace(/^"+|"+$/g, "");
  if (!looksLikeWindowsPath(cleaned)) return false;

  const normalized = normalizePath(cleaned);

  const match = findMatchingRoot(normalized, registry);
  if (!match) return false;

  const { prefix, rootPath } = match;
  const relative = normalized.slice(rootPath.length).replace(/^\/+/, "");

  const filename = relative.split("/").at(-1) ?? relative;
  const replacement = `[${filename}](${prefix}:${relative})`;
  editor.replaceSelection(replacement);

  return true;
}

function looksLikeWindowsPath(text: string): boolean {
  return /^[A-Za-z]:[\\/]/.test(text);
}

function findMatchingRoot(
  absolutePath: string,
  registry: RootRegistry
): { prefix: string; rootPath: string } | null {
  const candidates = registry.getEnabled();

  // Choose the longest matching root path
  let bestMatch: { prefix: string; rootPath: string } | null = null;

  for (const root of candidates) {
    const rootPath = normalizePath(root.path);
    if (!absolutePath.startsWith(rootPath)) continue;

    if (!bestMatch || rootPath.length > bestMatch.rootPath.length) {
      bestMatch = { prefix: root.prefix, rootPath };
    }
  }

  return bestMatch;
}
