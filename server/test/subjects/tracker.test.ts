import { describe, expect, test } from "bun:test";
import { AgentError, commit, readLibrary, readSubject } from "../../src/agent/ops";
import { buildExport, importSubjects, parseImport } from "../../src/dataExport";
import { db } from "../../src/db";
import { createSubject, getSubject, updateSubject } from "../../src/subjects";
import { makeUser } from "../helpers";

const tracker = (userId: string, name = "Guitar", level: number | null = null) =>
  createSubject(userId, name, "", "orange", "#ff9600", "#ff4b4b", { type: "tracker", level });

function expectInvalid(run: () => unknown) {
  try {
    run();
  } catch (error) {
    expect(error).toBeInstanceOf(AgentError);
    expect((error as AgentError).status).toBe(400);
    return;
  }
  throw new Error("Expected an AgentError");
}

describe("trackers and levels", () => {
  test("a tracker keeps its type, level and notes; subjects default to type subject, unrated", () => {
    const user = makeUser();
    expect(createSubject(user.id, "Physics", "", "green", "#58cc02", "#1cb0f6")).toMatchObject({ type: "subject", level: null, notes: "", completedCount: 0 });
    const { id } = tracker(user.id, "Guitar", 4);
    expect(getSubject(user.id, id).subject).toMatchObject({ type: "tracker", level: 4 });
    expect(updateSubject(user.id, id, { level: 8, notes: "Barre chords next" })).toMatchObject({ type: "tracker", level: 8, notes: "Barre chords next", name: "Guitar" });
    expect(updateSubject(user.id, id, { level: null }).level).toBeNull();
  });

  test("levels must be whole numbers from 0 to 10", () => {
    const user = makeUser();
    expect(() => tracker(user.id, "x", 11)).toThrow("Level");
    expect(() => tracker(user.id, "x", -1)).toThrow("Level");
    const { id } = tracker(user.id);
    expect(() => updateSubject(user.id, id, { level: 2.5 })).toThrow("Level");
    expect(() => createSubject(user.id, "x", "", "green", "#58cc02", "#1cb0f6", { type: "course" as never })).toThrow("type");
  });

  test("completedCount counts skills with at least one star", () => {
    const user = makeUser();
    const result = commit(user.id, { command: { op: "putSubject", subject: { name: "Spanish" } } }).result as { id: string };
    const unit = commit(user.id, { command: { op: "putUnit", unit: { subjectId: result.id, title: "Basics" } } }).result as { id: string };
    const skills = ["a", "b"].map((title) => (commit(user.id, { command: { op: "putSkill", skill: { unitId: unit.id, title } } }).result as { id: string }).id);
    db.run("INSERT INTO skill_progress (user_id, skill_id, stars, mastery, correct_attempts, total_attempts) VALUES (?, ?, 1, 0.3, 1, 1)", [user.id, skills[0]!]);
    expect(getSubject(user.id, result.id).subject).toMatchObject({ skillCount: 2, completedCount: 1 });
  });
});

describe("agent", () => {
  test("putSubject creates and rates a tracker, which then shows in the library and reads", () => {
    const user = makeUser();
    const { id } = commit(user.id, { command: { op: "putSubject", subject: { type: "tracker", name: "Gym", level: 5, notes: "3x a week" } } }).result as { id: string };
    expect(readLibrary(user.id).subjects.find((subject) => subject.id === id)).toMatchObject({ type: "tracker", level: 5 });
    commit(user.id, { command: { op: "putSubject", subject: { id, level: 6 } } });
    expect(readSubject(user.id, id).subject).toMatchObject({ type: "tracker", level: 6, notes: "3x a week" });
  });

  test("a tracker refuses units, a type change and a bad level", () => {
    const user = makeUser();
    const { id } = tracker(user.id);
    expectInvalid(() => commit(user.id, { command: { op: "putUnit", unit: { subjectId: id, title: "Chords" } } }));
    expectInvalid(() => commit(user.id, { command: { op: "putSubject", subject: { id, type: "subject" } } }));
    expectInvalid(() => commit(user.id, { command: { op: "putSubject", subject: { id, level: 12 } } }));
    expectInvalid(() => commit(user.id, { command: { op: "putSubject", subject: { name: "x", type: "course" } } }));
  });
});

describe("export", () => {
  test("a backup round-trips type, level and notes; a single share leaves the personal ones out", () => {
    const user = makeUser();
    const { id } = tracker(user.id, "Piano", 7);
    updateSubject(user.id, id, { notes: "Scales daily" });
    expect(buildExport(user.id, id).subjects[0]).toMatchObject({ type: "tracker" });
    expect(buildExport(user.id, id).subjects[0]!.level).toBeUndefined();

    const other = makeUser();
    const { folders, subjects } = parseImport(buildExport(user.id));
    const [imported] = importSubjects(other.id, subjects, folders).subjects;
    expect(imported).toMatchObject({ type: "tracker", level: 7, notes: "Scales daily", name: "Piano" });
  });

  test("units on an imported tracker are dropped", () => {
    const { subjects } = parseImport({ format: "halolesson", formatVersion: 1, subjects: [{ type: "tracker", name: "Run", units: [{ title: "u", skills: [] }] }] });
    expect(subjects[0]!.units).toEqual([]);
  });
});
