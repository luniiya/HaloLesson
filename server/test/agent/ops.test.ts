import { describe, expect, test } from "bun:test";
import { AgentError, commit, readLibrary, readProgress, readSubject } from "../../src/agent/ops";
import { submitAttempt } from "../practice-helper";
import { makeUser } from "../helpers";

function put(userId: string, command: Record<string, unknown>, extra: Record<string, unknown> = {}) {
  return commit(userId, { command, ...extra });
}

function expectAgentError(run: () => unknown, status: number, code: string) {
  try {
    run();
  } catch (error) {
    expect(error).toBeInstanceOf(AgentError);
    expect((error as AgentError).status).toBe(status);
    expect((error as AgentError).code).toBe(code);
    return error as AgentError;
  }
  throw new Error("Expected an AgentError");
}

const mc = (prompt: string) => ({ type: "multiple_choice", prompt, options: ["a", "b"], correctIndex: 1, explanation: "b" });
const ft = (prompt: string) => ({ type: "free_text", prompt, answers: ["x"], explanation: "" });

function scaffold() {
  const user = makeUser();
  const subjectId = put(user.id, { op: "putSubject", subject: { name: "Algebra" } }).result.id as string;
  const unitId = put(user.id, { op: "putUnit", unit: { subjectId, title: "Basics" } }).result.id as string;
  return { user, subjectId, unitId };
}

describe("putSubject", () => {
  test("creates with defaults and bumps the revision", () => {
    const user = makeUser();
    const before = readLibrary(user.id).revision;
    const saved = put(user.id, { op: "putSubject", subject: { name: "  Physics " } });
    expect(saved.revision).toBe(before + 1);
    const { subject } = readSubject(user.id, saved.result.id as string);
    expect(subject).toMatchObject({ name: "Physics", description: "", color: "green", gradientStart: "#58cc02" });
  });

  test("update keeps fields that are left out", () => {
    const user = makeUser();
    const id = put(user.id, { op: "putSubject", subject: { name: "A", description: "keep me", color: "red" } }).result.id;
    put(user.id, { op: "putSubject", subject: { id, name: "B" } });
    expect(readSubject(user.id, id as string).subject).toMatchObject({ name: "B", description: "keep me", color: "red" });
  });

  test("rejects bad colors and missing names", () => {
    const user = makeUser();
    expectAgentError(() => put(user.id, { op: "putSubject", subject: { name: "A", color: "pink" } }), 400, "INVALID");
    expectAgentError(() => put(user.id, { op: "putSubject", subject: { name: "A", gradientEnd: "red" } }), 400, "INVALID");
    expectAgentError(() => put(user.id, { op: "putSubject", subject: {} }), 400, "INVALID");
  });
});

describe("units and skills", () => {
  test("new records append; position reorders siblings", () => {
    const { user, subjectId } = scaffold();
    const second = put(user.id, { op: "putUnit", unit: { subjectId, title: "Second" } }).result.id;
    put(user.id, { op: "putUnit", unit: { subjectId, title: "First", position: 0 } });
    expect(readSubject(user.id, subjectId).units.map((unit) => unit.title)).toEqual(["First", "Basics", "Second"]);
    put(user.id, { op: "putUnit", unit: { id: second, position: 0 } });
    expect(readSubject(user.id, subjectId).units.map((unit) => unit.title)).toEqual(["Second", "First", "Basics"]);
  });

  test("putSkill creates exercises and returns their ids in order", () => {
    const { user, subjectId, unitId } = scaffold();
    const saved = put(user.id, { op: "putSkill", skill: { unitId, title: "Factoring", exercises: [mc("one"), ft("two")] } });
    expect(saved.result.exerciseIds).toHaveLength(2);
    const skill = readSubject(user.id, subjectId).units[0]!.skills[0]!;
    expect(skill.exercises.map((exercise) => exercise.id)).toEqual(saved.result.exerciseIds as string[]);
    expect(skill.exercises[0]).toMatchObject({ type: "multiple_choice", options: ["a", "b"], correctIndex: 1 });
    expect(skill.exercises[1]).toMatchObject({ type: "free_text", answers: ["x"] });
  });

  test("exercise list replaces: kept ids update, new ones insert, missing ones go", () => {
    const { user, subjectId, unitId } = scaffold();
    const saved = put(user.id, { op: "putSkill", skill: { unitId, title: "S", exercises: [mc("one"), mc("two"), mc("three")] } });
    const [one, , three] = saved.result.exerciseIds as string[];
    const next = put(user.id, {
      op: "putSkill",
      skill: { id: saved.result.id, exercises: [{ ...mc("three edited"), id: three }, ft("new"), { ...mc("one"), id: one }] },
    });
    const ids = next.result.exerciseIds as string[];
    expect(ids[0]).toBe(three!);
    expect(ids[2]).toBe(one!);
    const exercises = readSubject(user.id, subjectId).units[0]!.skills[0]!.exercises;
    expect(exercises.map((exercise) => exercise.prompt)).toEqual(["three edited", "new", "one"]);
  });

  test("omitting exercises keeps them", () => {
    const { user, subjectId, unitId } = scaffold();
    const id = put(user.id, { op: "putSkill", skill: { unitId, title: "S", exercises: [mc("one")] } }).result.id;
    put(user.id, { op: "putSkill", skill: { id, title: "Renamed" } });
    const skill = readSubject(user.id, subjectId).units[0]!.skills[0]!;
    expect(skill.title).toBe("Renamed");
    expect(skill.exercises).toHaveLength(1);
  });

  test("an exercise id from another skill is rejected", () => {
    const { user, unitId } = scaffold();
    const other = put(user.id, { op: "putSkill", skill: { unitId, title: "A", exercises: [mc("one")] } });
    const foreign = (other.result.exerciseIds as string[])[0];
    expectAgentError(() => put(user.id, { op: "putSkill", skill: { unitId, title: "B", exercises: [{ ...mc("x"), id: foreign }] } }), 404, "NOT_FOUND");
  });

  test("invalid exercises fail the whole command", () => {
    const { user, subjectId, unitId } = scaffold();
    expectAgentError(() => put(user.id, { op: "putSkill", skill: { unitId, title: "S", exercises: [{ ...mc("x"), correctIndex: 5 }] } }), 400, "INVALID");
    expectAgentError(() => put(user.id, { op: "putSkill", skill: { unitId, title: "S", exercises: [{ type: "free_text", prompt: "x", answers: [] }] } }), 400, "INVALID");
    expect(readSubject(user.id, subjectId).units[0]!.skills).toHaveLength(0);
  });

  test("moving a skill to another unit", () => {
    const { user, subjectId, unitId } = scaffold();
    const otherUnit = put(user.id, { op: "putUnit", unit: { subjectId, title: "Other" } }).result.id;
    const skillId = put(user.id, { op: "putSkill", skill: { unitId, title: "S" } }).result.id;
    put(user.id, { op: "putSkill", skill: { id: skillId, unitId: otherUnit } });
    const units = readSubject(user.id, subjectId).units;
    expect(units[0]!.skills).toHaveLength(0);
    expect(units[1]!.skills[0]!.id).toBe(skillId as string);
  });

  test("delete cascades", () => {
    const { user, subjectId, unitId } = scaffold();
    put(user.id, { op: "putSkill", skill: { unitId, title: "S", exercises: [mc("one")] } });
    put(user.id, { op: "deleteUnit", id: unitId });
    expect(readSubject(user.id, subjectId).units).toHaveLength(0);
  });

  test("deleting a subject only moves it to the trash", () => {
    const { user, subjectId } = scaffold();
    expect(put(user.id, { op: "deleteSubject", id: subjectId }).result).toEqual({ deleted: subjectId, trashed: true });
    const [trashed] = readLibrary(user.id).subjects;
    expect(trashed).toMatchObject({ id: subjectId, state: "trashed" });
    expect(trashed!.purgesAt).toBeString();
    expectAgentError(() => readSubject(user.id, subjectId), 404, "NOT_FOUND");
    put(user.id, { op: "restoreItem", kind: "subject", id: subjectId });
    expect(readSubject(user.id, subjectId).units).toHaveLength(1);
  });
});

describe("isolation between accounts", () => {
  test("another user's ids look like they don't exist", () => {
    const owner = scaffold();
    const intruder = makeUser();
    expectAgentError(() => readSubject(intruder.id, owner.subjectId), 404, "NOT_FOUND");
    expectAgentError(() => put(intruder.id, { op: "putUnit", unit: { subjectId: owner.subjectId, title: "x" } }), 404, "NOT_FOUND");
    expectAgentError(() => put(intruder.id, { op: "putSkill", skill: { unitId: owner.unitId, title: "x" } }), 404, "NOT_FOUND");
    expectAgentError(() => put(intruder.id, { op: "deleteSubject", id: owner.subjectId }), 404, "NOT_FOUND");
    expectAgentError(() => put(intruder.id, { op: "trashItem", kind: "subject", id: owner.subjectId }), 404, "NOT_FOUND");
    expectAgentError(() => put(intruder.id, { op: "moveItem", kind: "subject", id: owner.subjectId, parentId: null }), 404, "NOT_FOUND");
    expect(readLibrary(intruder.id).subjects).toHaveLength(0);
  });
});

describe("commit reliability", () => {
  test("same requestId and body replays instead of applying twice", () => {
    const user = makeUser();
    const body = { requestId: crypto.randomUUID(), command: { op: "putSubject", subject: { name: "Once" } } };
    const first = commit(user.id, body);
    const second = commit(user.id, body);
    expect(second).toEqual({ ...first, replayed: true });
    expect(readLibrary(user.id).subjects).toHaveLength(1);
  });

  test("reusing a requestId for a different command is a conflict", () => {
    const user = makeUser();
    const requestId = crypto.randomUUID();
    commit(user.id, { requestId, command: { op: "putSubject", subject: { name: "A" } } });
    expectAgentError(() => commit(user.id, { requestId, command: { op: "putSubject", subject: { name: "B" } } }), 409, "REQUEST_ID_REUSED");
  });

  test("requestIds are per account", () => {
    const requestId = crypto.randomUUID();
    const body = { requestId, command: { op: "putSubject", subject: { name: "A" } } };
    commit(makeUser().id, body);
    expect(commit(makeUser().id, body).replayed).toBeUndefined();
  });

  test("stale expectedRevision is rejected with the current revision", () => {
    const user = makeUser();
    const { revision } = readLibrary(user.id);
    put(user.id, { op: "putSubject", subject: { name: "A" } }, { expectedRevision: revision });
    const error = expectAgentError(() => put(user.id, { op: "putSubject", subject: { name: "B" } }, { expectedRevision: revision }), 409, "REVISION_CONFLICT");
    expect(error.extra.revision).toBe(revision + 1);
  });

  test("malformed bodies and unknown ops", () => {
    const user = makeUser();
    expectAgentError(() => commit(user.id, []), 400, "INVALID");
    expectAgentError(() => commit(user.id, { command: { op: "nuke" } }), 400, "UNKNOWN_OP");
    expectAgentError(() => commit(user.id, { requestId: "short", command: { op: "putSubject", subject: { name: "A" } } }), 400, "INVALID");
  });
});

describe("readProgress", () => {
  test("lists practiced skills and wrong answers with readable values", () => {
    const { user, subjectId, unitId } = scaffold();
    const saved = put(user.id, { op: "putSkill", skill: { unitId, title: "S", exercises: [mc("pick b"), ft("say x")] } });
    const [choice, free] = saved.result.exerciseIds as string[];
    submitAttempt(user.id, choice!, 0);
    submitAttempt(user.id, free!, "y");
    submitAttempt(user.id, free!, "X");
    const progress = readProgress(user.id, subjectId);
    expect(progress.skills).toHaveLength(1);
    expect(progress.skills[0]).toMatchObject({ skillTitle: "S", correctAttempts: 1, totalAttempts: 3 });
    expect(progress.recentMistakes.map((mistake) => [mistake.answerGiven, mistake.correctAnswer]).sort()).toEqual([["a", "b"], ["y", "x"]]);
    expectAgentError(() => readProgress(makeUser().id, subjectId), 404, "NOT_FOUND");
  });
});

describe("library organisation", () => {
  test("folders nest, hold subjects and keep a shared order", () => {
    const user = makeUser();
    const outer = put(user.id, { op: "putFolder", folder: { name: "School", color: "#12b5a5" } }).result.id as string;
    const inner = put(user.id, { op: "putFolder", folder: { name: "Maths", parentId: outer } }).result.id as string;
    const a = put(user.id, { op: "putSubject", subject: { name: "A", folderId: inner, icon: "rocket" } }).result.id as string;
    const b = put(user.id, { op: "putSubject", subject: { name: "B", folderId: inner, position: 0 } }).result.id as string;
    const library = readLibrary(user.id);
    expect(library.folders.find((folder) => folder.id === inner)).toMatchObject({ parentId: outer, state: "active" });
    expect(library.subjects.find((subject) => subject.id === a)).toMatchObject({ folderId: inner, icon: "rocket", position: 1 });
    expect(library.subjects.find((subject) => subject.id === b)).toMatchObject({ folderId: inner, position: 0 });
    put(user.id, { op: "moveItem", kind: "subject", id: a, parentId: null });
    expect(readLibrary(user.id).subjects.find((subject) => subject.id === a)!.folderId).toBeNull();
    expectAgentError(() => put(user.id, { op: "moveItem", kind: "folder", id: outer, parentId: inner }), 400, "INVALID");
    expectAgentError(() => put(user.id, { op: "putSubject", subject: { name: "C", icon: "nope" } }), 400, "INVALID");
    expectAgentError(() => put(user.id, { op: "putSubject", subject: { name: "C", folderId: "missing" } }), 404, "NOT_FOUND");
  });

  test("archive and trash are inherited by what is inside a folder", () => {
    const user = makeUser();
    const folder = put(user.id, { op: "putFolder", folder: { name: "F" } }).result.id as string;
    const subject = put(user.id, { op: "putSubject", subject: { name: "S", folderId: folder } }).result.id as string;
    const stateOf = () => readLibrary(user.id).subjects.find((item) => item.id === subject)!.state;
    put(user.id, { op: "archiveItem", kind: "folder", id: folder });
    expect(stateOf()).toBe("archived");
    put(user.id, { op: "trashItem", kind: "folder", id: folder });
    expect(stateOf()).toBe("trashed");
    put(user.id, { op: "restoreItem", kind: "folder", id: folder });
    expect(stateOf()).toBe("archived");
    put(user.id, { op: "archiveItem", kind: "folder", id: folder, archived: false });
    expect(stateOf()).toBe("active");
  });
});
