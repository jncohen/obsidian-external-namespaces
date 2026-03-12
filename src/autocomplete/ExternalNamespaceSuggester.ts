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

export class ExternalNamespaceSuggester extends EditorSuggest<IndexedPath> {
  private indexer: FileIndexer;

  constructor(app: App, indexer: FileIndexer) {
    super(app);
    this.indexer = indexer;
  }

  setIndexer(indexer: FileIndexer): void {
    this.indexer = indexer;
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
    if (!sandbox) return results.slice(0, 50);

    return results
      .filter(item => item.relativePath.startsWith(`${sandbox}/`))
      .slice(0, 50);
  }

  renderSuggestion(value: IndexedPath, el: HTMLElement): void {
    el.setText(value.relativePath);
  }

  selectSuggestion(value: IndexedPath): void {
    const context = this.context;
    if (!context) return;

    const replacement = `[[${value.prefix}:${value.relativePath}]]`;
    context.editor.replaceRange(replacement, context.start, context.end);
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
