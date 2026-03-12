import {
  App,
  Editor,
  EditorPosition,
  EditorSuggest,
  EditorSuggestContext,
  EditorSuggestTriggerInfo,
  TFile
} from "obsidian";
import { FileIndexer, IndexedPath } from "../indexing/FileIndexer";
import { RootRegistry } from "../roots/RootRegistry";

// Sentinel value returned when a registered namespace has no matching files.
// Keeps the plugin's popup open so Obsidian's native "Create note" completer
// cannot take over with an invalid filename.
const NO_RESULTS: IndexedPath = { prefix: "", relativePath: "" };

export class ExternalNamespaceSuggester extends EditorSuggest<IndexedPath> {
  private indexer: FileIndexer;
  private registry: RootRegistry;

  constructor(app: App, indexer: FileIndexer, registry: RootRegistry) {
    super(app);
    this.indexer = indexer;
    this.registry = registry;
  }

  setIndexer(indexer: FileIndexer): void {
    this.indexer = indexer;
  }

  setRegistry(registry: RootRegistry): void {
    this.registry = registry;
  }

  onTrigger(
    cursor: EditorPosition,
    editor: Editor,
    _file: TFile | null
  ): EditorSuggestTriggerInfo | null {
    const line = editor.getLine(cursor.line);
    const beforeCursor = line.slice(0, cursor.ch);

    const match = beforeCursor.match(/\[\[([a-zA-Z0-9_-]+):([^\]]*)$/);
    if (!match) return null;

    if (!this.registry.has(match[1])) return null;

    const bracketStart = beforeCursor.lastIndexOf("[[");

    return {
      start: { line: cursor.line, ch: bracketStart },
      end: cursor,
      query: `${match[1]}:${match[2]}`
    };
  }

  getSuggestions(context: EditorSuggestContext): IndexedPath[] {
    const colonIdx = context.query.indexOf(":");
    if (colonIdx === -1) return [];

    const prefix = context.query.slice(0, colonIdx);
    const pathQuery = context.query.slice(colonIdx + 1);

    const results = this.indexer.search(prefix, pathQuery);

    const sandbox = this.getSandboxFolder(prefix, context.file);
    if (!sandbox) {
      return results.length > 0 ? results.slice(0, 50) : [NO_RESULTS];
    }

    const filtered = results
      .filter(item => item.relativePath.startsWith(`${sandbox}/`))
      .slice(0, 50);
    return filtered.length > 0 ? filtered : [NO_RESULTS];
  }

  renderSuggestion(value: IndexedPath, el: HTMLElement): void {
    if (value === NO_RESULTS) {
      el.setText("(no matching files)");
      el.addClass("external-namespace-no-results");
      return;
    }
    el.setText(value.relativePath);
  }

  selectSuggestion(value: IndexedPath): void {
    if (value === NO_RESULTS) return;

    const context = this.context;
    if (!context) return;

    // Use the last path segment as the display label.
    const segments = value.relativePath.split("/");
    const filename = segments[segments.length - 1] ?? value.relativePath;

    // Output a standard markdown link: [filename](prefix:path)
    // This avoids Obsidian treating the link as a vault wikilink, which
    // fails on Windows because `:` is illegal in filenames.
    const replacement = `[${filename}](${value.prefix}:${value.relativePath})`;

    // Obsidian auto-pairs [[ with ]], placing the cursor inside [[|]].
    // Consume the auto-paired ]] so we don't leave dangling brackets.
    const line = context.editor.getLine(context.end.line);
    const afterEnd = line.slice(context.end.ch);
    const end = afterEnd.startsWith("]]")
      ? { line: context.end.line, ch: context.end.ch + 2 }
      : context.end;

    context.editor.replaceRange(replacement, context.start, end);
  }

  private getSandboxFolder(prefix: string, file: TFile | null): string | null {
    if (!file) return null;

    const cache = this.app.metadataCache.getFileCache(file);
    const frontmatter = cache?.frontmatter;
    if (!frontmatter) return null;

    const key = `${prefix}-folder`;
    const folder = frontmatter[key];

    return typeof folder === "string" ? folder : null;
  }
}
