import { Plugin } from "obsidian";
import {
  ExternalNamespacesSettings,
  DEFAULT_SETTINGS,
  ExternalNamespacesSettingTab
} from "./settings";
import { RootRegistry } from "./roots/RootRegistry";
import { FileSystemResolver } from "./resolvers/FileSystemResolver";
import { normalizePaste } from "./paste/normalizePaste";
import { FileIndexer } from "./indexing/FileIndexer";
import { ExternalNamespaceSuggester } from "./autocomplete/ExternalNamespaceSuggester";
import { ExternalEmbedHandler } from "./embeds/ExternalEmbedHandler";



export default class ExternalNamespacesPlugin extends Plugin {
  settings!: ExternalNamespacesSettings;
  rootRegistry!: RootRegistry;
  resolver!: FileSystemResolver;
  indexer!: FileIndexer;
  suggester!: ExternalNamespaceSuggester;
  embedHandler!: ExternalEmbedHandler;


  async onload() {
    await this.loadSettings();

    this.initializeRootRegistry();
    this.initializeResolver();
    await this.initializeIndexer();
    this.initializeSuggester();
    this.initializeEmbedHandler();

    this.addSettingTab(
      new ExternalNamespacesSettingTab(this.app, this)
    );

    this.registerEditorSuggest(this.suggester);

    this.registerEvent(
      this.app.workspace.on("editor-paste", (evt, editor) => {
        const pasted = (evt.clipboardData?.getData("text") ?? "").trim();
        if (!pasted) return;

        const handled = normalizePaste(editor, pasted, this.rootRegistry);
        if (handled) evt.preventDefault();
      })
    );
  }

  onunload() {
    // nothing to clean up
  }

  async loadSettings() {
    this.settings = Object.assign(
      {},
      DEFAULT_SETTINGS,
      await this.loadData()
    );
  }

  async saveSettings() {
    await this.saveData(this.settings);
    this.initializeRootRegistry();
    this.initializeResolver();
    await this.initializeIndexer();
    this.suggester.setIndexer(this.indexer); // update the registered suggester in-place
    this.initializeEmbedHandler();
  }


  private initializeRootRegistry() {
    this.rootRegistry = new RootRegistry(this.settings);
  }

  private initializeResolver() {
    this.resolver = new FileSystemResolver(this.rootRegistry);
  }

  private async initializeIndexer(): Promise<void> {
    this.indexer = new FileIndexer(this.rootRegistry);
    await this.indexer.rebuild();
  }

  private initializeSuggester() {
    this.suggester = new ExternalNamespaceSuggester(this.app, this.indexer);
  }

  private initializeEmbedHandler() {
    this.embedHandler = new ExternalEmbedHandler(
      this.app,
      this.rootRegistry,
      this.resolver
    );
    this.embedHandler.register(this);
  }
}
