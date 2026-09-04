# External Namespaces

An Obsidian plugin for linking to files and folders outside your vault, even
when those folders live in different local paths on different devices.

This is useful when you keep shared work in services like Dropbox, OneDrive,
Google Drive, or a network drive. The same synced folder might be
`D:\Dropbox` on one computer and `C:\Users\Joe\Dropbox` on another. External
Namespaces lets you write links with a stable prefix, such as `dropbox:`, while
each device stores its own local folder path for that prefix.

> **Desktop only · Requires Obsidian 1.5.0+**

---

## How it works

You register folders with short prefix names in the plugin settings. The
prefix is saved with your vault, while the folder path is stored only on the
current device:

| Prefix | Folder path |
|---|---|
| `dropbox` | `D:\Dropbox` |
| `work` | `C:\Users\Joe\Documents\Work` |

When you paste a Windows path from one of those folders into a note, the plugin
converts it automatically:

```
D:\Dropbox\papers\smith2020.pdf
  →  [smith2020.pdf](obsidian://ens?p=dropbox:papers/smith2020.pdf)
```

In reading or preview mode, only the filename label is visible. Clicking it
opens the file (or folder) in its default application via Obsidian's internal
`obsidian://ens` handler — no Windows protocol registration required.

Folder paths work too: pasting `D:\Dropbox\papers` produces a link that opens
that folder in Explorer.

On another device, you can use the same `dropbox:` links after setting that
device's local Dropbox folder path in the plugin settings.

---

## Installation

### Manual

1. Download `main.js`, `manifest.json`, and `styles.css` from the
   [latest release](https://github.com/jncohen/obsidian-external-namespaces/releases/latest)
2. In your vault create `.obsidian/plugins/external-namespaces/`
3. Copy the three files into that folder
4. Restart Obsidian, then go to **Settings → Community Plugins** and enable
   **External Namespaces**

---

## Setup

1. Go to **Settings → External Namespaces**
2. Click **+ Add root**
3. Enter a short prefix (e.g. `dropbox`) and the full path to the folder
   (e.g. `D:\Dropbox`)
4. On each other device, use the same prefix but enter that device's local path
   to the same synced folder
5. Repeat for any other folders you want to link from

---

## Usage

### Paste a path

Copy any file or folder path from Windows Explorer (right-click →
**Copy as path**, or just copy from the address bar), then paste it into
a note while in editing mode. If the path falls under a registered root,
the plugin replaces it with a formatted link. If it doesn't match any root,
the path is pasted unchanged.

### Write links manually

Links use standard Markdown syntax with an `obsidian://ens?p=` URL:

```markdown
[smith2020.pdf](obsidian://ens?p=dropbox:papers/smith2020.pdf)
[Q1 report](obsidian://ens?p=work:reports/Q1.xlsx)
[Papers folder](obsidian://ens?p=dropbox:papers)
```

In reading or preview mode these render as ordinary links showing only the
label text.

If a name contains a space, `&`, `#` or `%`, percent-encode it — a raw space
would end the Markdown link early, and a raw `&` would cut the URL short:

```markdown
[Lecture Framework.pdf](obsidian://ens?p=gdrive:Teaching/Lecture%20Framework.pdf)
[Q1&Q2 notes.md](obsidian://ens?p=gdrive:Teaching/Q1%26Q2%20notes.md)
```

Pasted links are encoded for you. Leave `/` between folders as-is.

### Migrate from an older version

If you used a previous version of this plugin with Dropbox, OneDrive, or
custom root settings, those will be imported into the new format automatically
on first load.

---

## Privacy and security

**This plugin accesses files and folders outside your Obsidian vault.** That is
its purpose: it exists to link notes to documents you keep in synced folders
such as Dropbox, OneDrive, or Google Drive, which by definition live outside the
vault. Without out-of-vault access the plugin could not do anything useful.

That access is deliberately narrow:

- It only opens paths beneath a folder root that you have registered yourself in
  the plugin settings. Nothing else on your computer is reachable.
- A link that resolves outside a registered root — for example one using `..` to
  climb above it — is refused rather than opened.
- Opening is delegated to the operating system's default application for the
  file. The plugin never reads, writes, or modifies file contents.
- All resolution is local filesystem only. No network requests, no cloud APIs,
  no telemetry.
- Folder paths are stored on each device separately and are never synced.

---

## License

[MIT](LICENSE) © Joseph N. Cohen

---

## Status

Active development. Core functionality (paste conversion and link opening)
is stable.
