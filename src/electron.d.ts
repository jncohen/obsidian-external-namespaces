/**
 * Minimal typing for the sliver of Electron this plugin uses.
 *
 * Obsidian supplies `electron` at runtime on desktop, and esbuild marks it
 * external, so no dependency is bundled. Declaring it here lets the import be
 * fully typed instead of reaching through an untyped runtime require.
 */
declare module "electron" {
  export const shell: {
    /** Opens the given path in the OS default application. */
    openPath(path: string): Promise<string>;
  };
}
