# External Namespaces

External Namespaces is an Obsidian plugin that allows notes to link to files
outside the vault using explicit, prefix-based namespaces.

The plugin is designed for users who manage large external folder structures
(e.g. Dropbox, OneDrive, project directories) and want stable, readable links
inside Obsidian without copying files into the vault.

This plugin was created using Claude Code.

## Installation

### From the Obsidian Community Plugin Browser (recommended)

1. Open Obsidian and go to **Settings → Community Plugins**
2. Disable Safe Mode if prompted
3. Click **Browse** and search for "External Namespaces"
4. Click **Install**, then **Enable**

### Manual Installation

1. Download `main.js`, `manifest.json`, and `styles.css` from the [latest release](https://github.com/josephncohen/obsidian-external-namespaces/releases/latest)
2. In your vault, create the folder `.obsidian/plugins/external-namespaces/`
3. Copy the three downloaded files into that folder
4. Restart Obsidian, then go to **Settings → Community Plugins** and enable **External Namespaces**

### After Installing

1. Go to **Settings → External Namespaces**
2. Enter the local path to each folder you want to expose as a namespace (e.g. your Dropbox or OneDrive folder) and enable it
3. Custom folders can be added under **Custom Roots** with any prefix name you choose

> **Note:** This plugin is desktop-only. It requires Obsidian 1.5.0 or later.

---

## Motivation

Many Obsidian users work across multiple devices while syncing large external
folders via cloud services such as Dropbox or OneDrive. Although the underlying
files are the same, their absolute filesystem paths often differ across machines
(e.g. different usernames, drive letters, or mount points).

As a result, absolute paths, file:// URLs, and symlinks are not portable: links
that work on one device break on another. This makes it difficult to reference
external files reliably in long-lived notes.

External Namespaces solves this by decoupling note links from machine-specific
paths, allowing the same note to resolve correctly on every device.

---

## Core Concept

External files are referenced using a standard Markdown link with a namespace
prefix as the URL scheme:

```
[filename.csv](dropbox:ProjectA/data/file.csv)
```

The display label can be anything you like. The `dropbox:` prefix identifies
the namespace, and the path after it is resolved relative to that namespace root.

Namespaces map to folders on the local filesystem. All resolution is local and
performed on disk; no cloud APIs are used.

---

## Supported Namespaces

The plugin supports:

- Dropbox folders
- OneDrive folders (multiple accounts supported)
- Arbitrary user-defined folders

Each namespace is configured in the plugin settings.

---

## Link Syntax

### Standard links

```
[file.csv](dropbox:ProjectA/data/file.csv)
[Q1 report](onedrive:Reports/Q1.xlsx)
[notes](custom-root:subfolder/document.pdf)
```

Clicking a link opens the file in its default application.

Image files are rendered inline when supported by Obsidian.

### PDF behavior

PDF files are **not embedded inline**. PDF embeds are silently suppressed to
avoid broken rendering. PDFs can still be opened via standard links.

This behavior is intentional.

---

## Note-Scoped Sandboxing

A note may restrict a namespace to a subfolder using frontmatter:

```
dropbox-folder: "ProjectA"
```

When set:

- All `dropbox:` links in the note are restricted to that folder
- Autocomplete suggestions are limited to that subtree
- Embeds are subject to the same restriction

Sandboxing is enforced silently.

---

## Autocomplete

To insert a namespaced link with autocomplete:

1. Type `[[` followed by the namespace prefix and a colon — e.g. `[[dropbox:`
2. Continue typing to filter the file list
3. Select a file from the popup

The plugin inserts a properly-formed Markdown link, for example:

```
[file.csv](dropbox:ProjectA/data/file.csv)
```

Suggestions respect namespace configuration and note-level sandboxing.

---

## Paste Normalization (Windows)

When a Windows "Copy as path" path is pasted into a note (including
quoted paths from the **Copy as path** context menu), and the path falls
under a configured namespace root, it is automatically converted to a
namespaced link.

For example, pasting `"C:\Users\you\Dropbox\Reports\Q1.xlsx"` produces:

```
[Q1.xlsx](dropbox:Reports/Q1.xlsx)
```

Non-matching paths are left untouched.

---

## Privacy and Security

- All resolution is local filesystem only
- No network requests
- No telemetry
- No cloud APIs
- No file contents are read or modified

---

## Status

This plugin is currently in beta. Behavior is stable, but APIs and UI may change
based on feedback.

---
