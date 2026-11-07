import { describe, expect, test } from "bun:test";
import { AgentError, commit, readStats } from "../../src/agent/ops";
import { buildExport, importSubjects, parseImport } from "../../src/dataExport";
import { db } from "../../src/db";
import { submitAttempt } from "../practice-helper";
import { checkStatsOptions, getStats } from "../../src/stats";
import { createSubject, updateSubject } from "../../src/subjects";
import { makeUser } from "../helpers";

const DAY_MS = 24 * 60 * 60 * 1000;
const run = (userId: string, command: Record<string, unknown>) => commit(userId, { command }).result as Record<string, unknown>;

// A subject with one skill of two multiple-choice exercises (answer 1 is right).
function practiced() {
  const user = makeUser();
  const subjectId = run(user.id, { op: "putSubject", subject: { name: "Algebra" } }).id as string;
  const unitId = run(user.id, { op: "putUnit", unit: { subjectId, title: "Basics" } }).id as string;
  const exercise = { type: "multiple_choice", prompt: "p", options: ["a", "b"], correctIndex: 1, explanation: "" };
  const exerciseIds = run(user.id, { op: "putSkill", skill: { unitId, title: "Sums", exercises: [exercise, exercise] } }).exerciseIds as string[];
  return { user, subjectId, exerciseIds };
}

// Moves every attempt of a user back by whole days, to fake history.
function shiftAttempts(userId: string, days: number) {
  for (const row of db.query<{ id: string; created_at: string }, [string]>("SELECT id, created_at FROM attempts WHERE user_id = ?").all(userId)) {
    db.run("UPDATE attempts SET created_at = ? WHERE id = ?", [new Date(Date.parse(row.created_at) - days * DAY_MS).toISOString(), row.id]);
  }
}

describe("statistics", () => {
  test("totals, daily buckets, mastery and time come from attempts", () => {
    const { user, subjectId, exerciseIds } = practiced();
    submitAttempt(user.id, exerciseIds[0]!, 1, 4000);
    submitAttempt(user.id, exerciseIds[1]!, 0, 6000);
    submitAttempt(user.id, exerciseIds[1]!, 1, 99 * 60 * 1000);
    const stats = getStats(user.id, { subjectId, days: 7 });
    expect(stats.daily).toHaveLength(7);
    expect(stats.totals).toMatchObject({ answered: 3, correct: 2, timeMs: 10000, practiceDays: 1, currentStreak: 1, skillCount: 1, skillsStarted: 1 });
    expect(stats.daily.at(-1)).toMatchObject({ answered: 3, correct: 2 });
    expect(stats.daily.at(-1)!.mastery).toBeGreaterThan(0);
    expect(stats.skills[0]).toMatchObject({ title: "Sums", unitTitle: "Basics", answered: 3 });
    expect(stats.weekdays.reduce((a, b) => a + b)).toBe(3);
  });

  test("streaks span all time, the range only filters totals", () => {
    const { user, exerciseIds } = practiced();
    submitAttempt(user.id, exerciseIds[0]!, 1);
    shiftAttempts(user.id, 1);
    submitAttempt(user.id, exerciseIds[0]!, 1);
    shiftAttempts(user.id, 9);
    submitAttempt(user.id, exerciseIds[0]!, 1);
    // Answers on day -10, day -9 and today.
    const week = getStats(user.id, { days: 7 });
    expect(week.totals).toMatchObject({ answered: 1, currentStreak: 1, longestStreak: 2 });
    expect(getStats(user.id).daily).toHaveLength(11);
  });

  test("every level change is kept and the start-of-range rating carries over", () => {
    const user = makeUser();
    const { id } = createSubject(user.id, "Guitar", "", "orange", "#ff9600", "#ff4b4b", { type: "tracker", level: 3 });
    db.run("UPDATE level_history SET created_at = ? WHERE subject_id = ?", [new Date(Date.now() - 40 * DAY_MS).toISOString(), id]);
    updateSubject(user.id, id, { level: 5 });
    updateSubject(user.id, id, { notes: "no level change" });
    const stats = getStats(user.id, { days: 30 });
    expect(stats.levels.map((point) => point.level)).toEqual([3, 5]);
    expect(stats.items.find((item) => item.id === id)).toMatchObject({ level: 5, levelAtStart: 3 });
    expect(stats.totals.ratings).toBe(1);
  });

  test("trashed items stay out of everything, options are validated", () => {
    const { user, subjectId } = practiced();
    run(user.id, { op: "trashItem", kind: "subject", id: subjectId });
    expect(getStats(user.id).items).toHaveLength(0);
    expect(() => checkStatsOptions({ days: 12 })).toThrow("Days");
    expect(() => checkStatsOptions({ tzOffset: 5000 })).toThrow("tzOffset");
    expect(checkStatsOptions({ days: "all", tzOffset: "-120" })).toEqual({ subjectId: null, days: null, tzOffset: -120 });
  });

  test("the agent reads the same statistics", () => {
    const { user, subjectId, exerciseIds } = practiced();
    submitAttempt(user.id, exerciseIds[0]!, 1);
    expect(readStats(user.id, { subjectId, days: 30 })).toMatchObject({ subjectId, totals: { answered: 1 } });
    expect(() => readStats(user.id, { days: 3 })).toThrow(AgentError);
    expect(() => readStats(makeUser().id, { subjectId })).toThrow("not found");
  });

  test("a backup carries level history and attempts", () => {
    const { user, subjectId, exerciseIds } = practiced();
    updateSubject(user.id, subjectId, { level: 2 });
    updateSubject(user.id, subjectId, { level: 6 });
    submitAttempt(user.id, exerciseIds[0]!, 1, 3000);
    const other = makeUser();
    const { folders, subjects } = parseImport(JSON.parse(JSON.stringify(buildExport(user.id))));
    const [copy] = importSubjects(other.id, subjects, folders).subjects;
    const stats = getStats(other.id, { subjectId: copy!.id });
    expect(stats.totals).toMatchObject({ answered: 1, timeMs: 3000 });
    expect(stats.levels.map((point) => point.level)).toEqual([2, 6]);
    expect(buildExport(user.id, subjectId).subjects[0]!.levelHistory).toBeUndefined();
  });
});
