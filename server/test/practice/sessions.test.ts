import { describe, expect, test } from "bun:test";
import { medalFor } from "@halolesson/shared";
import { commit, readInsight, readProgress, readSubject } from "../../src/agent/ops";
import { buildExport, importSubjects, parseImport } from "../../src/dataExport";
import { db } from "../../src/db";
import { gradeOf, recall, review } from "../../src/memory";
import { answerSession, quitSession, startSession } from "../../src/practice";
import { pickExercises, skillInsight } from "../../src/recommender";
import { getSubject } from "../../src/subjects";
import { makeUser } from "../helpers";
import { submitAttempt } from "../practice-helper";

const run = (userId: string, command: Record<string, unknown>) => commit(userId, { command }).result as Record<string, unknown>;
// Right answer is "b" (index 1).
const mc = (prompt: string, tier = "easy", concepts: string[] = []) => ({ type: "multiple_choice", tier, concepts, prompt, options: ["a", "b"], correctIndex: 1, explanation: "" });

function skill(exercises: object[], settings: Record<string, unknown> = {}) {
  const user = makeUser();
  const subjectId = run(user.id, { op: "putSubject", subject: { name: "Calculus" } }).id as string;
  const unitId = run(user.id, { op: "putUnit", unit: { subjectId, title: "Integrals" } }).id as string;
  const saved = run(user.id, { op: "putSkill", skill: { unitId, title: "Integrals", exercises, ...settings } });
  return { user, subjectId, skillId: saved.id as string, exerciseIds: saved.exerciseIds as string[] };
}

const tiersCleared = (userId: string, skillId: string) => db.query<{ tiers_cleared: number }, [string, string]>("SELECT tiers_cleared FROM skill_progress WHERE user_id = ? AND skill_id = ?").get(userId, skillId)?.tiers_cleared ?? 0;

// Plays a session to the end, answering right unless `wrong` says otherwise.
function play(userId: string, skillId: string, tier?: string, wrong: (prompt: string, attempt: number) => boolean = () => false) {
  let session = startSession(userId, skillId, tier);
  for (let attempt = 0; session.status === "active"; attempt += 1) {
    const current = session.queue[0]!;
    session = answerSession(userId, session.id, current.id, wrong(current.prompt, attempt) ? 0 : 1, 1000).session;
  }
  return session;
}

describe("sessions", () => {
  test("a session plays one tier's pool, at most sessionSize questions", () => {
    const { user, skillId } = skill([mc("e1"), mc("e2"), mc("e3"), mc("m1", "medium")], { sessionSize: 2 });
    const session = startSession(user.id, skillId);
    expect(session).toMatchObject({ tier: "easy", total: 2, hearts: 3, heartsLeft: 3, status: "active" });
    expect(session.queue.every((exercise) => exercise.prompt.startsWith("e"))).toBe(true);
    // No answers leak to the browser.
    expect(JSON.stringify(session)).not.toContain("correctIndex");
  });

  test("a wrong answer costs a heart and comes back at the end", () => {
    const { user, skillId } = skill([mc("e1"), mc("e2")]);
    const session = startSession(user.id, skillId);
    const first = session.queue[0]!;
    const result = answerSession(user.id, session.id, first.id, 0);
    expect(result).toMatchObject({ correct: false, correctAnswer: "b", requeued: true });
    expect(result.session.heartsLeft).toBe(2);
    expect(result.session.queue.map((exercise) => exercise.id)).toEqual([session.queue[1]!.id, first.id]);
    expect(() => answerSession(user.id, session.id, first.id, 1)).toThrow("current question");
  });

  test("clearing tiers in order; out of hearts records answers but doesn't clear", () => {
    const { user, skillId } = skill([mc("e1"), mc("m1", "medium")], { hearts: 1 });
    expect(() => startSession(user.id, skillId, "medium")).toThrow("Clear Easy first");
    const failed = play(user.id, skillId, undefined, () => true);
    expect(failed.status).toBe("failed");
    expect(tiersCleared(user.id, skillId)).toBe(0);
    expect(db.query("SELECT COUNT(*) AS n FROM attempts WHERE session_id = ?").get(failed.id)).toEqual({ n: 1 });
    expect(play(user.id, skillId).status).toBe("cleared");
    expect(tiersCleared(user.id, skillId)).toBe(1);
    // Replaying a cleared tier doesn't advance; the default moves on to medium.
    play(user.id, skillId, "easy");
    expect(tiersCleared(user.id, skillId)).toBe(1);
    expect(startSession(user.id, skillId).tier).toBe("medium");
  });

  test("an empty tier can't be played, and starting again quits the open session", () => {
    const { user, skillId } = skill([mc("e1")]);
    const first = startSession(user.id, skillId);
    startSession(user.id, skillId);
    expect(quitSession(user.id, first.id).status).toBe("quit");
    play(user.id, skillId);
    expect(() => startSession(user.id, skillId)).toThrow("Medium has no exercises yet");
  });

  test("clearing expert makes the skill gold, and the medal fades", () => {
    const { user, subjectId, skillId } = skill(["easy", "medium", "hard", "expert"].map((tier) => mc(tier, tier)));
    for (const tier of ["easy", "medium", "hard", "expert"]) play(user.id, skillId, tier);
    const node = getSubject(user.id, subjectId).units[0]!.skills[0]!;
    expect(node).toMatchObject({ tiersCleared: 4, medal: "gold", tierCounts: [1, 1, 1, 1] });
    const day = 86_400_000;
    expect(medalFor(new Date(Date.now() - 59 * day).toISOString())).toBe("gold");
    expect(medalFor(new Date(Date.now() - 61 * day).toISOString())).toBe("silver");
    expect(medalFor(new Date(Date.now() - 400 * day).toISOString())).toBe("copper");
    expect(medalFor(null)).toBeNull();
  });
});

describe("recommender", () => {
  test("FSRS: recall fades with time, and a wrong answer forgets faster", () => {
    const start = Date.UTC(2026, 0, 1);
    const day = 86_400_000;
    const good = review(review(null, start, 3), start + 2 * day, 3);
    const bad = review(review(null, start, 3), start + 2 * day, 1);
    expect(recall(good, good.at)).toBeCloseTo(1);
    expect(recall(good, good.at + 30 * day)).toBeLessThan(recall(good, good.at + day));
    expect(bad.stability).toBeLessThan(good.stability);
    expect(bad.difficulty).toBeGreaterThan(good.difficulty);
    expect(gradeOf(false, 100, 1000)).toBe(1);
    expect(gradeOf(true, 3000, 1000)).toBe(2);
    expect(gradeOf(true, 1000, 1000)).toBe(3);
    expect(gradeOf(true, 300, 1000)).toBe(4);
  });

  test("the exercises you got wrong are served first", () => {
    const { user, skillId, exerciseIds } = skill(Array.from({ length: 6 }, (_, index) => mc(`q${index}`)));
    for (const id of exerciseIds) submitAttempt(user.id, id, id === exerciseIds[4] ? 0 : 1, 1000);
    for (let round = 0; round < 5; round += 1) expect(pickExercises(user.id, skillId, 0, 1)).toEqual([exerciseIds[4]!]);
  });

  test("insight ranks concepts by fail rate and lists the likeliest fails", () => {
    const { user, skillId, exerciseIds } = skill([mc("q1", "easy", ["chain rule"]), mc("q2", "easy", ["chain rule", "+C"]), mc("q3", "easy", ["+C"])]);
    submitAttempt(user.id, exerciseIds[0]!, 1, 1000);
    submitAttempt(user.id, exerciseIds[1]!, 0, 4000);
    submitAttempt(user.id, exerciseIds[2]!, 0, 3000);
    const insight = skillInsight(user.id, skillId);
    expect(insight.concepts.map((concept) => [concept.concept, concept.failRate])).toEqual([["+C", 1], ["chain rule", 0.5]]);
    expect(insight.hardest[0]).toMatchObject({ lastWrong: true });
    expect(insight.hardest.at(-1)!.exerciseId).toBe(exerciseIds[0]!);
  });
});

describe("agent and files", () => {
  test("agents set tiers, concepts and settings, and read the struggles", () => {
    const { user, subjectId, skillId, exerciseIds } = skill([mc("q1", "hard", ["limits"])], { sessionSize: 5, hearts: 4 });
    const read = readSubject(user.id, subjectId).units[0]!.skills[0]!;
    expect(read).toMatchObject({ sessionSize: 5, hearts: 4, tiersCleared: 0, medal: null });
    expect(read.exercises[0]).toMatchObject({ tier: "hard", concepts: ["limits"] });
    expect(() => run(user.id, { op: "putSkill", skill: { id: skillId, hearts: 0 } })).toThrow("Hearts");
    expect(() => run(user.id, { op: "putSkill", skill: { id: skillId, exercises: [mc("q", "legendary")] } })).toThrow("tier");
    submitAttempt(user.id, exerciseIds[0]!, 0, 2000);
    expect(readInsight(user.id, skillId).concepts[0]).toMatchObject({ concept: "limits", wrong: 1 });
    const progress = readProgress(user.id, subjectId);
    expect(progress.skills[0]!.struggles[0]!.concept).toBe("limits");
    expect(progress.recentMistakes[0]).toMatchObject({ tier: "hard", concepts: ["limits"], durationMs: 2000 });
  });

  test("export and import keep tiers, concepts, settings and the unlock tier", () => {
    const { user, subjectId } = skill([mc("q1", "expert", ["x"])], { sessionSize: 7, hearts: 2 });
    run(user.id, { op: "putSubject", subject: { id: subjectId, unlockInOrder: true, unlockTier: "hard" } });
    const file = buildExport(user.id, subjectId);
    const other = makeUser();
    const copy = importSubjects(other.id, parseImport(file).subjects).subjects[0]!;
    expect(copy.unlockTier).toBe("hard");
    const copied = readSubject(other.id, copy.id).units[0]!.skills[0]!;
    expect(copied).toMatchObject({ sessionSize: 7, hearts: 2 });
    expect(copied.exercises[0]).toMatchObject({ tier: "expert", concepts: ["x"] });
  });
});
