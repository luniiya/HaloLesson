import { describe, expect, test } from "bun:test";
import { libraryStates, TRASH_RETENTION_DAYS } from "@halolesson/shared";
import { db } from "../../src/db";
import { createFolder, getLibrary, moveItem, purgeTrash, restoreItem, setArchived, trashItem, updateFolder } from "../../src/library";
import { createSubject, getSubject, listSubjects, updateSubject } from "../../src/subjects";
import { makeUser } from "../helpers";

const subject = (userId: string, name: string, folderId: string | null = null) => createSubject(userId, name, "", "green", "#58cc02", "#1cb0f6", { folderId });
const order = (userId: string, parentId: string | null) => {
  const { folders, subjects } = getLibrary(userId);
  return [...folders.filter((f) => f.parentId === parentId), ...subjects.filter((s) => s.folderId === parentId)].sort((a, b) => a.position - b.position).map((item) => ("name" in item ? item.name : ""));
};

describe("editing", () => {
  test("updateSubject renames, recolors and sets an icon; partial patches keep the rest", () => {
    const user = makeUser();
    const { id } = subject(user.id, "Old");
    const updated = updateSubject(user.id, id, { name: " New ", color: "blue", gradientStart: "#1cb0f6", icon: "bulb" });
    expect(updated).toMatchObject({ name: "New", color: "blue", gradientStart: "#1cb0f6", icon: "bulb", gradientEnd: "#1cb0f6" });
    expect(updateSubject(user.id, id, { icon: null }).icon).toBeNull();
    expect(() => updateSubject(user.id, id, { name: " " })).toThrow("required");
    expect(() => updateSubject(user.id, id, { icon: "nope" as never })).toThrow("icon");
    expect(() => updateSubject(makeUser().id, id, { name: "x" })).toThrow("Subject not found");
  });

  test("folders validate and only the owner can touch them", () => {
    const user = makeUser();
    const folder = createFolder(user.id, " Docs ", "#12b5a5");
    expect(folder).toMatchObject({ name: "Docs", color: "#12b5a5", parentId: null });
    expect(updateFolder(user.id, folder.id, { name: "Docs 2" })).toMatchObject({ name: "Docs 2", color: "#12b5a5" });
    expect(() => createFolder(user.id, "")).toThrow("required");
    expect(() => createFolder(user.id, "x", "red")).toThrow("color");
    expect(() => createFolder(user.id, "x", "#7c5cff", "missing")).toThrow("Folder not found");
    expect(() => updateFolder(makeUser().id, folder.id, { name: "hijack" })).toThrow("Folder not found");
  });
});

describe("ordering and nesting", () => {
  test("new items go last and moves renumber siblings across folders and subjects", () => {
    const user = makeUser();
    const a = subject(user.id, "A");
    const folder = createFolder(user.id, "F");
    const b = subject(user.id, "B");
    expect(order(user.id, null)).toEqual(["A", "F", "B"]);
    moveItem(user.id, "subject", b.id, null, 0);
    expect(order(user.id, null)).toEqual(["B", "A", "F"]);
    moveItem(user.id, "subject", a.id, folder.id);
    expect(order(user.id, null)).toEqual(["B", "F"]);
    expect(order(user.id, folder.id)).toEqual(["A"]);
    moveItem(user.id, "subject", b.id, folder.id, 0);
    expect(order(user.id, folder.id)).toEqual(["B", "A"]);
    moveItem(user.id, "subject", b.id, folder.id, 99);
    expect(order(user.id, folder.id)).toEqual(["A", "B"]);
  });

  test("folders nest but never loop, and moves stay inside one account", () => {
    const user = makeUser();
    const outer = createFolder(user.id, "outer");
    const inner = createFolder(user.id, "inner", "#7c5cff", outer.id);
    const deepest = createFolder(user.id, "deepest", "#7c5cff", inner.id);
    expect(() => moveItem(user.id, "folder", outer.id, deepest.id)).toThrow("inside itself");
    expect(() => moveItem(user.id, "folder", outer.id, outer.id)).toThrow("inside itself");
    const other = makeUser();
    const foreign = createFolder(other.id, "theirs");
    expect(() => moveItem(user.id, "folder", inner.id, foreign.id)).toThrow("Folder not found");
    expect(() => moveItem(other.id, "folder", inner.id, null)).toThrow("Folder not found");
  });
});

describe("archive and trash", () => {
  test("a folder's state is inherited by everything inside it; trash outranks archive", () => {
    const user = makeUser();
    const folder = createFolder(user.id, "F");
    const child = createFolder(user.id, "child", "#7c5cff", folder.id);
    const inside = subject(user.id, "S", child.id);
    const states = () => libraryStates(getLibrary(user.id));
    expect(states().get(inside.id)).toBe("active");
    setArchived(user.id, "folder", folder.id, true);
    expect(states().get(inside.id)).toBe("archived");
    trashItem(user.id, "folder", child.id);
    expect(states().get(inside.id)).toBe("trashed");
    expect(states().get(folder.id)).toBe("archived");
  });

  test("a trashed subject disappears from lists and detail but keeps its data", () => {
    const user = makeUser();
    const { id } = subject(user.id, "Gone");
    trashItem(user.id, "subject", id);
    expect(listSubjects(user.id)).toHaveLength(0);
    expect(listSubjects(user.id, true)).toHaveLength(1);
    expect(() => getSubject(user.id, id)).toThrow("Subject not found");
    restoreItem(user.id, "subject", id);
    expect(getSubject(user.id, id).subject.deletedAt).toBeNull();
  });

  test("restoring or unarchiving something hidden by its folder moves it to the top level", () => {
    const user = makeUser();
    const folder = createFolder(user.id, "F");
    const inside = subject(user.id, "S", folder.id);
    trashItem(user.id, "subject", inside.id);
    trashItem(user.id, "folder", folder.id);
    restoreItem(user.id, "subject", inside.id);
    const restored = getLibrary(user.id).subjects.find((item) => item.id === inside.id)!;
    expect(restored.folderId).toBeNull();
    expect(libraryStates(getLibrary(user.id)).get(inside.id)).toBe("active");
  });

  test("purge removes only items trashed more than 30 days ago, and a folder takes its contents", () => {
    const user = makeUser();
    const old = subject(user.id, "old");
    const recent = subject(user.id, "recent");
    const folder = createFolder(user.id, "F");
    const inside = subject(user.id, "inside", folder.id);
    const now = new Date();
    const daysAgo = (days: number) => new Date(now.getTime() - days * 86_400_000).toISOString();
    db.run("UPDATE subjects SET deleted_at = ? WHERE id = ?", [daysAgo(TRASH_RETENTION_DAYS + 1), old.id]);
    db.run("UPDATE subjects SET deleted_at = ? WHERE id = ?", [daysAgo(TRASH_RETENTION_DAYS - 1), recent.id]);
    db.run("UPDATE folders SET deleted_at = ? WHERE id = ?", [daysAgo(TRASH_RETENTION_DAYS + 1), folder.id]);
    purgeTrash(now);
    const left = getLibrary(user.id);
    expect(left.subjects.map((item) => item.id)).toEqual([recent.id]);
    expect(left.folders).toHaveLength(0);
    expect(left.subjects.some((item) => item.id === inside.id)).toBe(false);
  });

  test("the library API offers no permanent delete", async () => {
    const source = await Bun.file(`${import.meta.dir}/../../src/index.ts`).text();
    expect(source).not.toMatch(/DELETE: .*(Subject|Folder|Trash)/);
    expect(source).not.toContain("/api/library/delete");
  });
});
