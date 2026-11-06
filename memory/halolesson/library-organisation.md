---
name: library-organisation
description: Main-page Edit mode, nested folders, archive, 30-day trash (no manual permanent delete), subject icons
type: decision
---

*(as of 2026-11-06)* Built per [[feature-parity-rule]]. The circles on the main page are called **subjects** (folders look the same, with a folder icon).
- Data: `folders` table (nested via `parent_id`), subjects gained `folder_id`, `position`, `icon`, `archived_at`, `deleted_at`. Folders and subjects under one parent share one `position` order.
- State is inherited from folders above (`libraryStates` in `packages/shared`); trash outranks archive. Restoring/unarchiving something hidden only by its folder moves it to the top level.
- Trash: "delete" = `deleted_at`; `purgeTrash` (startup, hourly, and on library read) removes items after 30 days. No route, tool or button deletes permanently. Agent `deleteSubject` now only trashes; `deleteUnit`/`deleteSkill` are still immediate.
- Server: `server/src/library.ts`, routes `/api/library`, `/api/folders`, `/api/library/{move,archive,trash,restore}`, `PATCH /api/subjects/:id`. Agent ops `putFolder, moveItem, archiveItem, trashItem, restoreItem`, MCP tools `halo_put_folder/move/archive/trash/restore`. Tests: `server/test/subjects/library.test.ts`, `server/test/agent/`.
- Web: `SubjectsPage` (Edit button next to New subject; `?folder=` and `?view=archive|trash`), `LibraryEditor` (rename, colors, icon, reorder with arrows, move-to select, archive, trash), `LibraryShelf` (archive/trash lists). Reordering is arrow buttons, not drag and drop (not built).
- Not done: folders are not in the export/import file (trashed subjects are skipped on export).

*(as of 2026-11-06, later)* Edit mode redone at the user's request; it no longer shows a list.
- Edit keeps the same orbit (`web/src/components/LibraryOrbit.tsx`). The circles wiggle. Click one to open `LibraryItemDialog` (fields, location, open, archive, trash). Drag works with pointer events: drop on a ring slot to reorder, on a folder circle to move the item in, or on any `data-drop` element (`archive`, `trash`, `folder:<id>`, `folder:` for the top level). Sidebar Archive/Trash and the breadcrumbs are drop targets. While dragging, the circles stay still and the target slot is highlighted. `LibraryEditor` was deleted.
- Header in edit mode: `[+ Subject] [+ Folder]` (secondary) and then `Done` (primary/purple). Outside edit mode there is only `Edit`; the top-right New subject button is gone.
- Archive and Trash are now pages at `/archive` and `/trash` (`ShelfPage`), linked from the left sidebar; `?view=` was removed. Settings and the account block sit at the bottom of the sidebar, and the "Your learning space" label is gone.
- The export now carries folders (`folders[]`, parents first), plus subject `icon`, `folder` (index), `position` and `archivedAt`. The trash is left out. A file without these fields still imports. An import is appended after the existing top-level items. A single-subject share file has no placement fields. The round-trip test is `server/test/data/roundtrip.test.ts`. This supersedes the "Not done" line above.

*(as of 2026-11-06, later still)* Outside Edit mode, clicking a folder no longer goes to a folder page. It opens in place (`web/src/components/OrbitView.tsx`): its children fan out on dashed lines away from the center, and the orbit slides and shrinks to fit. Nested folders fan out again. The open chain is kept in `?open=id,id`. Escape, clicking the background or clicking the folder again closes it. An open folder is drawn as a pressed-in toggle (`.orbit-open`: face sunk, dark wall on top). The `?folder=` pages still exist (dialog "Open folder", breadcrumbs).

*(as of 2026-11-06, latest)* The `?folder=` folder page and its breadcrumbs are gone at the user's request. The main page always shows the top level, and folders only open in place (`?open=`). This replaces "The `?folder=` pages still exist" above.
- Edit mode uses the same layout (`layoutOrbit` / `OrbitStage` exported from `OrbitView.tsx`; `LibraryOrbit` renders editable circles on it). Each folder circle has a +/− button (`.orbit-expand`) that opens it in place. The dialog's "Open folder" opens it in place too.
- Drag in Edit mode: drop near any circle (ring or fanned child) to take its slot, which moves the item into that circle's folder if needed. Drop on a folder face or an "Empty folder" marker to move it in. The move index is counted among all siblings, archived ones too, the same way `moveItem` counts them.
- New subjects and folders are created in the innermost open folder.

*(2026-11-06)* Create-subject is now a popup dialog (agent-dialog, max-w-2xl, "like New folder but bigger"). Normal and Edit mode are now ONE component (LibraryOrbit with `editing`) so toggling Edit never remounts the orbit; OrbitView.tsx keeps only shared layout helpers.

*(2026-11-06)* Icons expanded to 120 (12 originals kept first, ids stable; stored in DB). web/src/lib/subjectIcons.ts has SUBJECT_ICON_INFO (label+keywords), searchIcons, autoIcon (keyword match on name, else id hash). IconPicker.tsx (search, separate Auto card) used in CreateSubjectForm and LibraryItemDialog.

*(2026-11-06)* Main page mode: View | Edit segmented toggle replaces the Edit/Done button (user unsure, Claude recommended the toggle; easy to revert).

*(2026-11-06, correction)* User did NOT want a segmented toggle: wants ONE button that flips between view and edit. Built: single button showing the current mode (Viewing / Editing), blue while editing.

*(2026-11-07)* Header layout: Add button must never wrap the title or shift the canvas. Built: Add is absolutely positioned against the mode button: left of it when the header is wide (container query), below it right-aligned otherwise.
