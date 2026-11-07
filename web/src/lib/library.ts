import { libraryStates, purgeDate, type Folder, type ItemKind, type ItemState, type Library, type Subject, type SubjectColor, type Tier } from "@halolesson/shared";
import { api } from "./api";

export type Entry = { kind: "folder"; item: Folder } | { kind: "subject"; item: Subject };

export const entryParent = (entry: Entry) => (entry.kind === "folder" ? entry.item.parentId : entry.item.folderId);

function post(path: string, body: Record<string, unknown>) {
  return api<unknown>(path, { method: "POST", body: JSON.stringify(body) });
}

function patch(path: string, body: Record<string, unknown>) {
  return api<unknown>(path, { method: "PATCH", body: JSON.stringify(body) });
}

// Every write below has an agent twin (putFolder, moveItem, archiveItem, trashItem, restoreItem, putSubject).
export const libraryApi = {
  get: () => api<Library>("/api/library"),
  move: (kind: ItemKind, id: string, parentId: string | null, index?: number) => post("/api/library/move", { kind, id, parentId, index }),
  archive: (kind: ItemKind, id: string, archived: boolean) => post("/api/library/archive", { kind, id, archived }),
  trash: (kind: ItemKind, id: string) => post("/api/library/trash", { kind, id }),
  restore: (kind: ItemKind, id: string) => post("/api/library/restore", { kind, id }),
  createFolder: (name: string, parentId: string | null) => post("/api/folders", { name, parentId }),
  updateFolder: (id: string, fields: { name?: string; color?: string }) => patch(`/api/folders/${id}`, fields),
  updateSubject: (id: string, fields: { name?: string; description?: string; color?: SubjectColor; gradientStart?: string; gradientEnd?: string; icon?: string | null; level?: number | null; notes?: string; unlockInOrder?: boolean; unlockTier?: Tier }) =>
    patch(`/api/subjects/${id}`, fields),
};

function sorted(entries: Entry[]): Entry[] {
  return entries.sort((a, b) => a.item.position - b.item.position || a.item.createdAt.localeCompare(b.item.createdAt));
}

// Folders and subjects directly under `parentId`, in the order the user set.
export function entriesIn(library: Library, parentId: string | null): Entry[] {
  return sorted([
    ...library.folders.filter((folder) => folder.parentId === parentId).map((item): Entry => ({ kind: "folder", item })),
    ...library.subjects.filter((subject) => subject.folderId === parentId).map((item): Entry => ({ kind: "subject", item })),
  ]);
}

// What the archive and trash views list: items in that state whose parent isn't
// already in it (a trashed folder shows once, not with all its contents).
export function topEntries(library: Library, state: ItemState): Entry[] {
  const states = libraryStates(library);
  const all: Entry[] = [
    ...library.folders.map((item): Entry => ({ kind: "folder", item })),
    ...library.subjects.map((item): Entry => ({ kind: "subject", item })),
  ];
  return sorted(all.filter((entry) => {
    if (states.get(entry.item.id) !== state) return false;
    const parent = entryParent(entry);
    return !parent || states.get(parent) !== state;
  }));
}

// Root-first chain of folders ending at `folderId`.
export function folderPath(library: Library, folderId: string | null): Folder[] {
  const byId = new Map(library.folders.map((folder) => [folder.id, folder]));
  const path: Folder[] = [];
  for (let id = folderId, guard = 0; id && guard < 64; guard += 1) {
    const folder = byId.get(id);
    if (!folder) break;
    path.unshift(folder);
    id = folder.parentId;
  }
  return path;
}

export function daysUntilPurge(deletedAt: string): number {
  return Math.max(0, Math.ceil((new Date(purgeDate(deletedAt)).getTime() - Date.now()) / 86_400_000));
}
