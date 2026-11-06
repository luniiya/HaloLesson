import { libraryStates, TRASH_RETENTION_DAYS, type Folder, type ItemKind, type Library } from "@halolesson/shared";
import { db } from "./db";
import { listSubjects, nextPosition } from "./subjects";

const MAX_FOLDERS = 200;
const HEX_COLOR = /^#[0-9a-f]{6}$/i;

interface FolderRow {
  id: string;
  parent_id: string | null;
  name: string;
  color: string;
  position: number;
  archived_at: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

function toFolder(row: FolderRow): Folder {
  return {
    id: row.id,
    parentId: row.parent_id,
    name: row.name,
    color: row.color,
    position: row.position,
    archivedAt: row.archived_at,
    deletedAt: row.deleted_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// Deletes trashed folders and subjects older than the retention period. A
// folder takes everything inside it along. This is the only way anything is
// ever permanently deleted from the library: there is no manual "empty trash".
export function purgeTrash(now = new Date(), userId?: string): void {
  const cutoff = new Date(now.getTime() - TRASH_RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const scope = userId ? "AND user_id = ?" : "";
  const params = userId ? [cutoff, userId] : [cutoff];
  db.transaction(() => {
    db.run(`DELETE FROM folders WHERE deleted_at IS NOT NULL AND deleted_at < ? ${scope}`, params);
    db.run(`DELETE FROM subjects WHERE deleted_at IS NOT NULL AND deleted_at < ? ${scope}`, params);
  })();
}

export function getLibrary(userId: string): Library {
  purgeTrash(new Date(), userId);
  const folders = db
    .query<FolderRow, [string]>("SELECT * FROM folders WHERE user_id = ? ORDER BY position, created_at")
    .all(userId)
    .map(toFolder);
  return { folders, subjects: listSubjects(userId, true) };
}

function ownedFolder(userId: string, folderId: string): FolderRow {
  const row = db.query<FolderRow, [string, string]>("SELECT * FROM folders WHERE id = ? AND user_id = ?").get(folderId, userId);
  if (!row) throw new Error("Folder not found");
  return row;
}

function ownedItem(userId: string, kind: ItemKind, id: string): { parentId: string | null } {
  if (kind === "folder") return { parentId: ownedFolder(userId, id).parent_id };
  const row = db.query<{ folder_id: string | null }, [string, string]>("SELECT folder_id FROM subjects WHERE id = ? AND user_id = ?").get(id, userId);
  if (!row) throw new Error("Subject not found");
  return { parentId: row.folder_id };
}

function checkFolderFields(name: string, color: string): { name: string; color: string } {
  name = name.trim();
  if (!name) throw new Error("Folder name is required");
  if (name.length > 80) throw new Error("Folder name must be 80 characters or fewer");
  if (!HEX_COLOR.test(color)) throw new Error("Choose a valid folder color");
  return { name, color };
}

export function createFolder(userId: string, name: string, color = "#7c5cff", parentId: string | null = null): Folder {
  const fields = checkFolderFields(name, color);
  if (parentId) ownedFolder(userId, parentId);
  if (db.query<{ count: number }, [string]>("SELECT COUNT(*) AS count FROM folders WHERE user_id = ?").get(userId)!.count >= MAX_FOLDERS) {
    throw new Error(`At most ${MAX_FOLDERS} folders per account`);
  }
  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  db.run("INSERT INTO folders (id, user_id, parent_id, name, color, position, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)", [
    id, userId, parentId, fields.name, fields.color, nextPosition(userId, parentId), now, now,
  ]);
  return toFolder(ownedFolder(userId, id));
}

// Partial edit: fields left out keep their value.
export function updateFolder(userId: string, folderId: string, patch: { name?: string; color?: string }): Folder {
  const current = ownedFolder(userId, folderId);
  const fields = checkFolderFields(patch.name ?? current.name, patch.color ?? current.color);
  db.run("UPDATE folders SET name = ?, color = ?, updated_at = ? WHERE id = ?", [fields.name, fields.color, new Date().toISOString(), folderId]);
  return toFolder(ownedFolder(userId, folderId));
}

// Puts an item under `parentId` (null is the top level) at `index` among the
// folders and subjects there (last when omitted), then renumbers its siblings.
export function moveItem(userId: string, kind: ItemKind, id: string, parentId: string | null, index?: number): void {
  ownedItem(userId, kind, id);
  if (parentId) {
    ownedFolder(userId, parentId);
    if (kind === "folder") {
      for (let cursor: string | null = parentId, depth = 0; cursor && depth < 64; depth += 1) {
        if (cursor === id) throw new Error("A folder can't go inside itself");
        cursor = db.query<{ parent_id: string | null }, [string]>("SELECT parent_id FROM folders WHERE id = ?").get(cursor)?.parent_id ?? null;
      }
    }
  }
  db.transaction(() => {
    const siblings = [
      ...db.query<{ id: string; position: number; created_at: string }, [string, string | null, string]>("SELECT id, position, created_at FROM subjects WHERE user_id = ? AND folder_id IS ? AND id != ?").all(userId, parentId, id).map((row) => ({ ...row, kind: "subject" as const })),
      ...db.query<{ id: string; position: number; created_at: string }, [string, string | null, string]>("SELECT id, position, created_at FROM folders WHERE user_id = ? AND parent_id IS ? AND id != ?").all(userId, parentId, id).map((row) => ({ ...row, kind: "folder" as const })),
    ].sort((a, b) => a.position - b.position || a.created_at.localeCompare(b.created_at));
    siblings.splice(index === undefined ? siblings.length : Math.max(0, Math.min(index, siblings.length)), 0, { id, kind, position: 0, created_at: "" });
    siblings.forEach((sibling, order) => {
      if (sibling.id === id) {
        db.run(kind === "folder" ? "UPDATE folders SET parent_id = ?, position = ?, updated_at = ? WHERE id = ?" : "UPDATE subjects SET folder_id = ?, position = ?, updated_at = ? WHERE id = ?", [parentId, order, new Date().toISOString(), id]);
      } else {
        db.run(sibling.kind === "folder" ? "UPDATE folders SET position = ? WHERE id = ?" : "UPDATE subjects SET position = ? WHERE id = ?", [order, sibling.id]);
      }
    });
  })();
}

function setFlag(userId: string, kind: ItemKind, id: string, column: "archived_at" | "deleted_at", on: boolean): void {
  ownedItem(userId, kind, id);
  const table = kind === "folder" ? "folders" : "subjects";
  db.run(`UPDATE ${table} SET ${column} = ?, updated_at = ? WHERE id = ?`, [on ? new Date().toISOString() : null, new Date().toISOString(), id]);
}

// After unarchiving or restoring, an item that is still hidden only because a
// folder above it is archived or trashed goes to the top level so it shows up.
function surface(userId: string, kind: ItemKind, id: string): void {
  const library = getLibrary(userId);
  const item = kind === "folder" ? library.folders.find((folder) => folder.id === id) : library.subjects.find((subject) => subject.id === id);
  if (!item || item.archivedAt || item.deletedAt) return;
  if (libraryStates(library).get(id) !== "active") moveItem(userId, kind, id, null);
}

export function setArchived(userId: string, kind: ItemKind, id: string, archived: boolean): void {
  setFlag(userId, kind, id, "archived_at", archived);
  if (!archived) surface(userId, kind, id);
}

// "Delete" in every interface: the item (and a folder's contents) waits in the
// trash for TRASH_RETENTION_DAYS, then purgeTrash removes it.
export function trashItem(userId: string, kind: ItemKind, id: string): void {
  ownedItem(userId, kind, id);
  const table = kind === "folder" ? "folders" : "subjects";
  db.run(`UPDATE ${table} SET deleted_at = COALESCE(deleted_at, ?), updated_at = ? WHERE id = ?`, [new Date().toISOString(), new Date().toISOString(), id]);
}

export function restoreItem(userId: string, kind: ItemKind, id: string): void {
  setFlag(userId, kind, id, "deleted_at", false);
  surface(userId, kind, id);
}
