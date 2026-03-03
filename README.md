# External Namespaces

External Namespaces is an Obsidian plugin that allows notes to link to files
outside the vault using explicit, prefix-based namespaces.

The plugin is designed for users who manage large external folder structures
(e.g. Dropbox, OneDrive, project directories) and want stable, readable links
inside Obsidian without copying files into the vault.

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

External files are referenced using a namespace prefix:

```
[[dropbox:ProjectA/data/file.csv]]
```


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
[[dropbox:ProjectA/data/file.csv]]
```


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

Typing:

```
[[dropbox:
```


triggers autocomplete suggestions based on indexed files. Suggestions respect
namespace configuration and note-level sandboxing.

---

## Paste Normalization (Windows)

When enabled, Windows “Copy as path” pastes (including quoted paths) are
automatically normalized into namespaced links when the file is inside a
configured namespace root.

Non-matching paths are left untouched.

---

## Privacy and Security

- All resolution is local filesystem only
- No network requests
- No telemetry
- No cloud APIs
- No file contents are read or modified

---

## Non-Goals

This plugin intentionally does **not**:

- Integrate with reference managers (e.g. Zotero)
- Manage citations or bibliographies
- Render PDFs inline
- Sync or upload files
- Modify external files

External Namespaces is infrastructure, not a document management system.

---

## Status

This plugin is currently in beta. Behavior is stable, but APIs and UI may change
based on feedback.

---
