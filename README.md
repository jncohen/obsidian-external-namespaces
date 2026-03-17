# External Namespaces

An Obsidian plugin that lets you link to files and folders outside your vault.
Register any folder with a short prefix; paste a Windows path and it becomes
a clickable link that opens the file in its default application.

> **Desktop only · Requires Obsidian 1.5.0+**

---

## How it works

You register folders with short prefix names in the plugin settings:

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
4. Repeat for any other folders you want to link from

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

### Migrate from an older version

If you used a previous version of this plugin with Dropbox, OneDrive, or
custom root settings, those will be imported into the new format automatically
on first load.

---

## Privacy and security

- All resolution is local filesystem only
- No network requests, no cloud APIs, no telemetry
- No file contents are read or modified

---

## Status

Active development. Core functionality (paste conversion and link opening)
is stable. Built with [Claude](https://claude.ai).
