import { App, MarkdownPostProcessorContext, Plugin } from "obsidian";
import { RootRegistry } from "../roots/RootRegistry";
import { FileSystemResolver } from "../resolvers/FileSystemResolver";

const IMAGE_EXTENSIONS = new Set([
  "png",
  "jpg",
  "jpeg",
  "gif",
  "svg",
  "webp",
  "avif",
  "bmp",
  "ico"
]);

export class ExternalEmbedHandler {
  private app: App;
  private roots: RootRegistry;
  private resolver: FileSystemResolver;

  constructor(app: App, roots: RootRegistry, resolver: FileSystemResolver) {
    this.app = app;
    this.roots = roots;
    this.resolver = resolver;
  }

  /**
   * Register the markdown post processor that gates embeds,
   * and a capture-phase click handler that intercepts namespace links
   * before Obsidian tries to open them as vault files.
   */
  register(plugin: Plugin) {
    plugin.registerMarkdownPostProcessor((el, ctx) => {
      this.processEmbeds(el, ctx);
    });

    plugin.registerDomEvent(document, "click", (evt: MouseEvent) => {
      this.interceptLinkClick(evt);
    }, true); // capture phase: fires before Obsidian's own click handler
  }

  /**
   * If the click is on an internal link whose href matches a registered
   * namespace, open the file externally and suppress Obsidian's default
   * behaviour (which would fail with an "invalid filename" error on Windows).
   */
  private interceptLinkClick(evt: MouseEvent) {
    // Namespace links are now rendered as standard markdown links (<a class="external-link">)
    // rather than wikilinks (<a class="internal-link">), since the [[prefix:path]] syntax
    // caused Obsidian to treat them as vault file references and reject the `:` on Windows.
    const link = (evt.target as HTMLElement).closest("a.external-link");
    if (!link) return;

    const href = (link.getAttribute("href") ?? "").trim();

    const colonIdx = href.indexOf(":");
    if (colonIdx === -1) return;

    const prefix = href.slice(0, colonIdx);
    if (!this.roots.has(prefix)) return;

    // It's one of our namespace links — always prevent Obsidian handling it.
    evt.preventDefault();
    evt.stopPropagation();

    const relativePath = href.slice(colonIdx + 1);
    if (relativePath) {
      this.resolver.open(href);
    }
  }

  /**
   * Inspect rendered embeds and silently remove those
   * that violate namespace, sandbox, or type rules.
   */
  private processEmbeds(
    el: HTMLElement,
    _ctx: MarkdownPostProcessorContext
  ) {
    const embeds = el.querySelectorAll("img, iframe, object");

    embeds.forEach(node => {
      const src = this.getSource(node);
      if (!src) return;

      const parsed = this.parseNamespacedPath(src);
      if (!parsed) return;

      const { prefix, relativePath } = parsed;

      if (!this.roots.has(prefix)) {
        this.remove(node);
        return;
      }

      const resolved = this.resolver.resolve(`${prefix}:${relativePath}`);
      if (!resolved) {
        this.remove(node);
        return;
      }

      const ext = this.getExtension(relativePath);
      if (!IMAGE_EXTENSIONS.has(ext)) {
        this.remove(node);
      }
    });
  }

  private getSource(node: Element): string | null {
    if (node instanceof HTMLImageElement) return node.getAttribute("src");
    if (node instanceof HTMLIFrameElement) return node.getAttribute("src");
    if (node instanceof HTMLObjectElement) return node.getAttribute("data");
    return null;
  }

  private parseNamespacedPath(
    src: string
  ): { prefix: string; relativePath: string } | null {
    const match = src.match(/^([a-zA-Z0-9_-]+):(.+)$/);
    if (!match) return null;

    return {
      prefix: match[1],
      relativePath: match[2]
    };
  }

  private getExtension(path: string): string {
    const idx = path.lastIndexOf(".");
    return idx === -1 ? "" : path.slice(idx + 1).toLowerCase();
  }

  private remove(node: Element) {
    node.remove();
  }
}
