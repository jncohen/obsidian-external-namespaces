import { App } from "obsidian";
import { Editor, EditorPosition, TFile } from "obsidian";
import { FileIndexer, IndexedPath } from "../indexing/FileIndexer";

export class ExternalNamespaceSuggester {
  private indexer: FileIndexer;

  private app: App;

  private getSandboxFolder(prefix: string): string | null {
    const file = this.app.workspace.getActiveFile();
    if (!file) return null;
    
    const cache = this.app.metadataCache.getFileCache(file);
    const frontmatter = cache?.frontmatter;
    if (!frontmatter) return null;
    
    const key = `${prefix}-folder`;
    const folder = frontmatter[key];
    
    return typeof folder === "string" ? folder : null;
}

  
  constructor(app: App, indexer: FileIndexer) {
    this.app = app;
    this.indexer = indexer;
   }


  /**
   * Called on every editor change.
   * Returns true if we should handle suggestions.
   */
  shouldTrigger(editor: Editor): boolean {
    const cursor = editor.getCursor();
    const line = editor.getLine(cursor.line);
    const beforeCursor = line.slice(0, cursor.ch);

    return /\[\[[a-zA-Z0-9_-]+:[^\]]*$/.test(beforeCursor);
  }

  /**
   * Compute suggestions based on current editor state.
   */
  getSuggestions(editor: Editor): IndexedPath[] {
    const cursor = editor.getCursor();
    const line = editor.getLine(cursor.line);
    const beforeCursor = line.slice(0, cursor.ch);

    const match = beforeCursor.match(/\[\[([a-zA-Z0-9_-]+):([^\]]*)$/);
    if (!match) return [];

    const prefix = match[1];
    const query = match[2] ?? "";

    const results = this.indexer.search(prefix, query);

    const sandbox = this.getSandboxFolder(prefix);
    if (!sandbox) return results.slice(0, 50);
    
    return results
    .filter(item =>
        item.relativePath.startsWith(`${sandbox}/`)
    )
    .slice(0, 50);
    
}

  /**
   * Insert the selected suggestion.
   */
  applySuggestion(
    editor: Editor,
    suggestion: IndexedPath
  ) {
    const cursor = editor.getCursor();
    const line = editor.getLine(cursor.line);

    const startCh = line.lastIndexOf("[[");
    if (startCh === -1) return;

    const replacement = `[[${suggestion.prefix}:${suggestion.relativePath}]]`;

    editor.replaceRange(
      replacement,
      { line: cursor.line, ch: startCh },
      cursor
    );
  }
}
