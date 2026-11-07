---
name: export-format-v2
description: Decisions for the .halo zip export format (backup vs share, re-import, personal data, import preview)
type: decision
---
*(as of 2026-11-07)* User decisions for the export redesign:
- Container: `.halo` zip, folder per subject, small JSON per unit/skill, manifest, `media/` reserved (proposed, user said "do it").
- Share/Export on a subject page = that subject only, for anyone to import. Export in Settings = the whole account (backup). No multi-select.
- Personal data (progress, level, notes, history) NEVER in shares; backups only.
- Re-import of items you already have (same id lineage): ask each time, "update mine" or "add a copy".
- Import shows a preview tree with checkboxes and a destination folder.
Related: [[halolesson-data-portability]], [[share-links]]

*(as of 2026-11-07)* Built end to end: server (haloFile.ts, dataExport.ts v2, agent ops/MCP tools) and web (ImportDialog preview+pick, DataSettings import flow, ShareDialog copy). Not visually checked yet.

*(as of 2026-11-07)* Extension renamed: files are now `.halolesson` (user asked), not `.halo`.
*(as of 2026-11-07)* "halo is too general": code names follow too — `halolessonFile.ts`, `toHalolesson`, `HALOLESSON_FILE_EXTENSION`, agent import field `halolesson` (base64). The halo artwork (BookArtwork) keeps its name.
