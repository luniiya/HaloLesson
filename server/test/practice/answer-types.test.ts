import { describe, expect, test } from "bun:test";
import { commit, readProgress, readSubject } from "../../src/agent/ops";
import { buildExport, importSubjects, parseImport } from "../../src/dataExport";
import { checkAnswer, contentJson, shuffled } from "../../src/exercises";
import { getSession, startSession } from "../../src/practice";
import { makeUser } from "../helpers";
import { submitAttempt } from "../practice-helper";

const run = (userId: string, command: Record<string, unknown>) => commit(userId, { command }).result as Record<string, unknown>;

const order = { type: "order", prompt: "Smallest first", items: ["1", "2", "3"], explanation: "" };
const match = { type: "match", prompt: "Derivatives", pairs: [["x^2", "2x"], ["sin x", "cos x"], ["e^x", "e^x"]], explanation: "" };
const blanks = { type: "fill_blanks", prompt: "The derivative of ___ is ___.", blanks: [["x^2", "x²"], ["2x"]], explanation: "" };

function skill(exercises: object[]) {
  const user = makeUser();
  const subjectId = run(user.id, { op: "putSubject", subject: { name: "Answer types" } }).id as string;
  const unitId = run(user.id, { op: "putUnit", unit: { subjectId, title: "U" } }).id as string;
  const saved = run(user.id, { op: "putSkill", skill: { unitId, title: "S", exercises } });
  return { user, subjectId, skillId: saved.id as string, exerciseIds: saved.exerciseIds as string[] };
}

const check = (exercise: typeof order | typeof match | typeof blanks, answer: unknown) =>
  checkAnswer(exercise.type as "order", exercise.prompt, contentJson(exercise as never), answer);

describe("answer types", () => {
  test("order: the items in sequence, text compared loosely", () => {
    expect(check(order, ["1", " 2", "3 "])).toEqual({ correct: true, correctAnswer: "1 → 2 → 3" });
    expect(check(order, ["2", "1", "3"]).correct).toBe(false);
    expect(check(order, ["1", "2"]).correct).toBe(false);
    expect(check(order, "1 2 3").correct).toBe(false);
  });

  test("match: the right item for each left one", () => {
    expect(check(match, ["2x", "COS X", "e^x"])).toEqual({ correct: true, correctAnswer: "x^2 → 2x; sin x → cos x; e^x → e^x" });
    expect(check(match, ["cos x", "2x", "e^x"]).correct).toBe(false);
  });

  test("fill_blanks: any accepted answer per blank", () => {
    expect(check(blanks, ["x²", "2X"])).toEqual({ correct: true, correctAnswer: "The derivative of x^2 is 2x." });
    expect(check(blanks, ["x^2", "x"]).correct).toBe(false);
    expect(check(blanks, ["x^2"]).correct).toBe(false);
  });

  test("shuffles are stable per seed and never the answer order", () => {
    for (let seed = 0; seed < 50; seed++) {
      const result = shuffled(["a", "b"], String(seed));
      expect(result).toEqual(["b", "a"]);
    }
    expect(shuffled(["a", "b", "c", "d"], "x")).toEqual(shuffled(["a", "b", "c", "d"], "x"));
    expect(shuffled(["a", "a"], "x")).toEqual(["a", "a"]);
  });

  test("practice shows shuffled items and no answers, and grades them", () => {
    const { user, skillId, exerciseIds } = skill([order, match, blanks]);
    const session = startSession(user.id, skillId);
    const byId = new Map(session.queue.map((exercise) => [exercise.id, exercise]));
    const [orderEx, matchEx, blanksEx] = exerciseIds.map((id) => byId.get(id)!);
    expect(orderEx!.options.slice().sort()).toEqual(["1", "2", "3"]);
    expect(orderEx!.options).not.toEqual(["1", "2", "3"]);
    expect(matchEx!.left).toEqual(["x^2", "sin x", "e^x"]);
    expect(matchEx!.options.slice().sort()).toEqual(["2x", "cos x", "e^x"]);
    expect(blanksEx!.options).toEqual([]);
    expect(JSON.stringify(blanksEx)).not.toContain("2x");
    // The same session reloads with the same shuffle.
    expect(getSession(user.id, session.id).queue).toEqual(session.queue);

    expect(submitAttempt(user.id, exerciseIds[0]!, ["1", "2", "3"]).correct).toBe(true);
    expect(submitAttempt(user.id, exerciseIds[1]!, ["2x", "cos x", "e^x"]).correct).toBe(true);
    const wrong = submitAttempt(user.id, exerciseIds[2]!, ["x^3", "3x^2"]);
    expect(wrong).toMatchObject({ correct: false, correctAnswer: "The derivative of x^2 is 2x." });
    // Agents read the wrong answer as text.
    const mistake = (readProgress(user.id) as { recentMistakes: Array<{ answerGiven: unknown; correctAnswer: unknown }> }).recentMistakes[0];
    expect(mistake).toMatchObject({ answerGiven: "The derivative of x^3 is 3x^2.", correctAnswer: "The derivative of x^2 is 2x." });
  });

  test("agents read the new types back as written", () => {
    const { user, subjectId } = skill([order, match, blanks]);
    const exercises = (readSubject(user.id, subjectId) as { units: Array<{ skills: Array<{ exercises: unknown[] }> }> }).units[0]!.skills[0]!.exercises;
    expect(exercises).toMatchObject([{ type: "order", items: ["1", "2", "3"] }, { type: "match", pairs: match.pairs }, { type: "fill_blanks", blanks: blanks.blanks }]);
  });

  test("invalid exercises are rejected", () => {
    const bad = (exercise: object) => () => skill([{ prompt: "p", explanation: "", ...exercise }]);
    expect(bad({ type: "order", items: ["only"] })).toThrow("at least 2 items");
    expect(bad({ type: "match", pairs: [["a", "1"]] })).toThrow("at least 2 pairs");
    expect(bad({ type: "match", pairs: [["a", "1"], ["b"]] })).toThrow("[left, right]");
    expect(bad({ type: "match", pairs: [["a", "1"], ["A", "2"]] })).toThrow("left items must all differ");
    expect(bad({ type: "fill_blanks", blanks: [["x"]] })).toThrow("at least one ___");
    expect(bad({ type: "fill_blanks", prompt: "___ and ___", blanks: [["x"]] })).toThrow("2 ___ blanks but 1");
    expect(bad({ type: "fill_blanks", prompt: "___", blanks: [[]] })).toThrow("blank 1 needs at least one");
    expect(bad({ type: "drag_and_drop" })).toThrow("type must be one of");
  });

  test("export and import keep the new types", () => {
    const { user } = skill([order, match, blanks]);
    const file = buildExport(user.id);
    const exported = file.subjects[0]!.units[0]!.skills[0]!.exercises;
    expect(exported).toMatchObject([{ type: "order", items: order.items }, { type: "match", pairs: match.pairs }, { type: "fill_blanks", blanks: blanks.blanks }]);
    const other = makeUser();
    const { subjects, folders } = parseImport(JSON.parse(JSON.stringify(file)));
    importSubjects(other.id, subjects, folders);
    const again = buildExport(other.id).subjects[0]!.units[0]!.skills[0]!.exercises;
    expect(again.map(({ id: _, ...rest }) => rest)).toEqual(exported.map(({ id: _, ...rest }) => rest));
  });
});
