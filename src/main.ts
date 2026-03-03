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
    this.initializeIndexer();
    this.initializeSuggester();
    this.initializeEmbedHandler();

    this.addSettingTab(
      new ExternalNamespacesSettingTab(this.app, this)
    );

    this.registerTestCommand();
    this.registerAutocompleteHandler();

    this.registerEvent(
      this.app.workspace.on("editor-paste", (evt, editor) => {
        const pasted = (evt.clipboardData?.getData("text") ?? "").trim();
        if (!pasted) return;

        const handled = normalizePaste(editor, pasted, this.rootRegistry);
        if (handled) evt.preventDefault();
      })
    );

    console.log("External Namespaces plugin loaded");
  }

  onunload() {
    console.log("External Namespaces plugin unloaded");
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
    this.initializeIndexer();
    this.initializeSuggester();
    this.initializeEmbedHandler();
}


  private initializeRootRegistry() {
    this.rootRegistry = new RootRegistry(this.settings);
  }

  private initializeResolver() {
    this.resolver = new FileSystemResolver(this.rootRegistry);
  }

  private initializeIndexer() {
    this.indexer = new FileIndexer(this.rootRegistry);
    this.indexer.rebuild();
  }

  private initializeSuggester() {
  this.suggester = new ExternalNamespaceSuggester(this.app, this.indexer);
}

  private registerAutocompleteHandler() {
    this.registerEvent(
      this.app.workspace.on("editor-change", editor => {
        if (!this.suggester.shouldTrigger(editor)) return;

        const suggestions = this.suggester.getSuggestions(editor);
        if (!suggestions.length) return;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (this.app as any).suggests?.showSuggestions({
          suggestions,
          renderSuggestion: (value: any, el: HTMLElement) => {
            el.setText(value.relativePath);
          },
          selectSuggestion: (value: any) => {
            this.suggester.applySuggestion(editor, value);
          }
        });
      })
    );
  }

  private initializeEmbedHandler() {
  this.embedHandler = new ExternalEmbedHandler(
    this.app,
    this.rootRegistry,
    this.resolver
  );
  this.embedHandler.register(this);
}


  /**
   * Temporary command for testing filesystem resolution.
   */
  private registerTestCommand() {
    this.addCommand({
      id: "external-namespaces-open-path",
      name: "Open External Namespaced Path",
      callback: async () => {
        const input = prompt(
          "Enter namespaced path (e.g. dropbox:foo/bar.txt)"
        );
        if (!input) return;

        this.resolver.open(input);
      }
    });
  }
}
