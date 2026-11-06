import { SUBJECT_COLORS, type ExerciseType, type SubjectColor } from "@halolesson/shared";
import { HEX_COLOR, list, parseExercise, record, text } from "../dataExport";
import { db } from "../db";
import { bumpRevision, libraryRevision, notifyLibrary } from "../events";
import { getSubject, listSubjects } from "../subjects";

const MAX_SUBJECTS = 500;
const MAX_UNITS_PER_SUBJECT = 100;
const MAX_SKILLS_PER_UNIT = 100;
const MAX_EXERCISES_PER_SKILL = 50;
const MAX_REPORTS_PER_USER = 50;
const REQUEST_ID = /^[a-zA-Z0-9_-]{8,100}$/;
const REQUEST_TTL_MS = 24 * 60 * 60 * 1000;

// Mapped to HTTP status codes and stable `code`s by the REST and MCP layers.
export class AgentError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
    readonly extra: Record<string, unknown> = {},
  ) {
    super(message);
  }
}

const notFound = (what: string) => new AgentError(`${what} not found`, 404, "NOT_FOUND");

export interface AgentExercise {
  id: string;
  type: ExerciseType;
  prompt: string;
  options?: string[];
  correctIndex?: number;
  answers?: string[];
  explanation: string;
}

interface ExerciseRow {
  id: string;
  type: ExerciseType;
  prompt: string;
  content_json: string;
  explanation: string;
}

function toExercise(row: ExerciseRow): AgentExercise {
  const content = JSON.parse(row.content_json) as { options?: string[]; correctIndex?: number; answers?: string[] };
  return row.type === "multiple_choice"
    ? { id: row.id, type: row.type, prompt: row.prompt, options: content.options ?? [], correctIndex: content.correctIndex ?? 0, explanation: row.explanation }
    : { id: row.id, type: row.type, prompt: row.prompt, answers: content.answers ?? [], explanation: row.explanation };
}

function exercisesOf(skillId: string): AgentExercise[] {
  return db.query<ExerciseRow, [string]>("SELECT * FROM exercises WHERE skill_id = ? ORDER BY position, created_at").all(skillId).map(toExercise);
}

// ---- Reads ----

export function readLibrary(userId: string) {
  return {
    revision: libraryRevision(userId),
    subjects: listSubjects(userId).map(({ id, name, description, unitCount, skillCount, updatedAt }) => ({ id, name, description, unitCount, skillCount, updatedAt })),
  };
}

export function readSubject(userId: string, subjectId: string) {
  let detail;
  try {
    detail = getSubject(userId, subjectId);
  } catch {
    throw notFound("Subject");
  }
  const { subject, units } = detail;
  return {
    revision: libraryRevision(userId),
    subject: { id: subject.id, name: subject.name, description: subject.description, color: subject.color, gradientStart: subject.gradientStart, gradientEnd: subject.gradientEnd },
    units: units.map((unit) => ({
      id: unit.id,
      title: unit.title,
      description: unit.description,
      skills: unit.skills.map((skill) => ({
        id: skill.id,
        title: skill.title,
        description: skill.description,
        stars: skill.stars,
        mastery: skill.mastery,
        exercises: exercisesOf(skill.id),
      })),
    })),
  };
}

interface ProgressRow {
  skill_id: string;
  skill_title: string;
  subject_id: string;
  subject_name: string;
  stars: number;
  mastery: number;
  correct_attempts: number;
  total_attempts: number;
  last_practiced_at: string | null;
}

interface MistakeRow extends ExerciseRow {
  skill_id: string;
  answer_json: string;
  created_at: string;
}

// What the learner has practiced and recently got wrong, so an agent can
// target weak spots. Optionally scoped to one subject.
export function readProgress(userId: string, subjectId?: string) {
  if (subjectId && !db.query("SELECT 1 FROM subjects WHERE id = ? AND user_id = ?").get(subjectId, userId)) throw notFound("Subject");
  const scope = subjectId ? "AND subjects.id = ?" : "";
  const params = subjectId ? [userId, subjectId] : [userId];
  const skills = db
    .query<ProgressRow, string[]>(`
      SELECT skills.id AS skill_id, skills.title AS skill_title, subjects.id AS subject_id, subjects.name AS subject_name,
        skill_progress.stars, skill_progress.mastery, skill_progress.correct_attempts, skill_progress.total_attempts, skill_progress.last_practiced_at
      FROM skill_progress JOIN skills ON skills.id = skill_progress.skill_id
      JOIN units ON units.id = skills.unit_id JOIN subjects ON subjects.id = units.subject_id
      WHERE skill_progress.user_id = ? ${scope} ORDER BY skill_progress.mastery
    `)
    .all(...params);
  const mistakes = db
    .query<MistakeRow, string[]>(`
      SELECT exercises.*, attempts.answer_json, attempts.created_at AS created_at FROM attempts
      JOIN exercises ON exercises.id = attempts.exercise_id JOIN skills ON skills.id = exercises.skill_id
      JOIN units ON units.id = skills.unit_id JOIN subjects ON subjects.id = units.subject_id
      WHERE attempts.user_id = ? AND attempts.is_correct = 0 ${scope} ORDER BY attempts.created_at DESC LIMIT 30
    `)
    .all(...params);
  return {
    revision: libraryRevision(userId),
    skills: skills.map((row) => ({
      skillId: row.skill_id,
      skillTitle: row.skill_title,
      subjectId: row.subject_id,
      subjectName: row.subject_name,
      stars: row.stars,
      mastery: Math.round(row.mastery * 100) / 100,
      correctAttempts: row.correct_attempts,
      totalAttempts: row.total_attempts,
      lastPracticedAt: row.last_practiced_at,
    })),
    recentMistakes: mistakes.map((row) => {
      const exercise = toExercise(row);
      const given: unknown = JSON.parse(row.answer_json);
      return {
        exerciseId: row.id,
        skillId: row.skill_id,
        prompt: exercise.prompt,
        answerGiven: exercise.type === "multiple_choice" && typeof given === "number" ? (exercise.options?.[given] ?? given) : given,
        correctAnswer: exercise.type === "multiple_choice" ? exercise.options?.[exercise.correctIndex ?? 0] : exercise.answers?.[0],
        at: row.created_at,
      };
    }),
  };
}

// ---- Writes ----

function optionalId(value: unknown, where: string): string | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value !== "string") throw new AgentError(`${where} must be a string`, 400, "INVALID");
  return value;
}

function requiredId(value: unknown, where: string): string {
  const id = optionalId(value, where);
  if (!id) throw new AgentError(`${where} is required`, 400, "INVALID");
  return id;
}

function position(value: unknown): number | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) throw new AgentError("position must be a whole number, 0 or more", 400, "INVALID");
  return value;
}

function ownedUnit(userId: string, unitId: string): { subject_id: string } {
  const row = db.query<{ subject_id: string }, [string, string]>(
    "SELECT units.subject_id FROM units JOIN subjects ON subjects.id = units.subject_id WHERE units.id = ? AND subjects.user_id = ?",
  ).get(unitId, userId);
  if (!row) throw notFound("Unit");
  return row;
}

function ownedSkill(userId: string, skillId: string): { unit_id: string; subject_id: string } {
  const row = db.query<{ unit_id: string; subject_id: string }, [string, string]>(
    `SELECT skills.unit_id, units.subject_id FROM skills JOIN units ON units.id = skills.unit_id
     JOIN subjects ON subjects.id = units.subject_id WHERE skills.id = ? AND subjects.user_id = ?`,
  ).get(skillId, userId);
  if (!row) throw notFound("Skill");
  return row;
}

function ownedSubject(userId: string, subjectId: string): void {
  if (!db.query("SELECT 1 FROM subjects WHERE id = ? AND user_id = ?").get(subjectId, userId)) throw notFound("Subject");
}

// Moves `id` to `index` among its siblings (append when undefined) and renumbers them.
function place(table: "units" | "skills", parentColumn: "subject_id" | "unit_id", parentId: string, id: string, index: number | undefined) {
  const ids = db.query<{ id: string }, [string, string]>(`SELECT id FROM ${table} WHERE ${parentColumn} = ? AND id != ? ORDER BY position, created_at`)
    .all(parentId, id)
    .map((row) => row.id);
  ids.splice(index === undefined ? ids.length : Math.min(index, ids.length), 0, id);
  ids.forEach((siblingId, siblingIndex) => db.run(`UPDATE ${table} SET position = ? WHERE id = ?`, [siblingIndex, siblingId]));
}

function countOf(sql: string, param: string): number {
  return db.query<{ count: number }, [string]>(sql).get(param)!.count;
}

function putSubject(userId: string, input: Record<string, unknown>) {
  const id = optionalId(input.id, "subject.id");
  const current = id
    ? db.query<{ name: string; description: string; color: SubjectColor; gradient_start: string; gradient_end: string }, [string, string]>(
        "SELECT * FROM subjects WHERE id = ? AND user_id = ?",
      ).get(id, userId)
    : null;
  if (id && !current) throw notFound("Subject");
  const name = input.name === undefined && current ? current.name : text(input.name, "subject.name", 80, true);
  const description = input.description === undefined && current ? current.description : text(input.description, "subject.description", 500);
  const color = input.color === undefined ? (current?.color ?? "green") : (input.color as SubjectColor);
  if (!SUBJECT_COLORS.includes(color)) throw new AgentError(`subject.color must be one of ${SUBJECT_COLORS.join(", ")}`, 400, "INVALID");
  const gradientStart = input.gradientStart === undefined ? (current?.gradient_start ?? "#58cc02") : input.gradientStart;
  const gradientEnd = input.gradientEnd === undefined ? (current?.gradient_end ?? "#1cb0f6") : input.gradientEnd;
  if (typeof gradientStart !== "string" || !HEX_COLOR.test(gradientStart) || typeof gradientEnd !== "string" || !HEX_COLOR.test(gradientEnd)) {
    throw new AgentError("subject.gradientStart and gradientEnd must be hex colors like #58cc02", 400, "INVALID");
  }
  const now = new Date().toISOString();
  if (current && id) {
    db.run("UPDATE subjects SET name = ?, description = ?, color = ?, gradient_start = ?, gradient_end = ?, updated_at = ? WHERE id = ?", [
      name, description, color, gradientStart, gradientEnd, now, id,
    ]);
    return { subjectId: id, result: { id } };
  }
  if (countOf("SELECT COUNT(*) AS count FROM subjects WHERE user_id = ?", userId) >= MAX_SUBJECTS) {
    throw new AgentError(`At most ${MAX_SUBJECTS} subjects per account`, 400, "LIMIT");
  }
  const newId = crypto.randomUUID();
  db.run("INSERT INTO subjects (id, user_id, name, description, color, gradient_start, gradient_end, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)", [
    newId, userId, name, description, color, gradientStart, gradientEnd, now, now,
  ]);
  return { subjectId: newId, result: { id: newId } };
}

function putUnit(userId: string, input: Record<string, unknown>) {
  const id = optionalId(input.id, "unit.id");
  const current = id
    ? db.query<{ subject_id: string; title: string; description: string }, [string, string]>(
        "SELECT units.* FROM units JOIN subjects ON subjects.id = units.subject_id WHERE units.id = ? AND subjects.user_id = ?",
      ).get(id, userId)
    : null;
  if (id && !current) throw notFound("Unit");
  const subjectId = optionalId(input.subjectId, "unit.subjectId") ?? current?.subject_id;
  if (!subjectId) throw new AgentError("unit.subjectId is required for a new unit", 400, "INVALID");
  ownedSubject(userId, subjectId);
  const title = input.title === undefined && current ? current.title : text(input.title, "unit.title", 120, true);
  const description = input.description === undefined && current ? current.description : text(input.description, "unit.description", 500);
  const index = position(input.position);
  const moved = current && current.subject_id !== subjectId;
  if ((!current || moved) && countOf("SELECT COUNT(*) AS count FROM units WHERE subject_id = ?", subjectId) >= MAX_UNITS_PER_SUBJECT) {
    throw new AgentError(`At most ${MAX_UNITS_PER_SUBJECT} units per subject`, 400, "LIMIT");
  }
  const unitId = id ?? crypto.randomUUID();
  if (current) db.run("UPDATE units SET subject_id = ?, title = ?, description = ? WHERE id = ?", [subjectId, title, description, unitId]);
  else db.run("INSERT INTO units (id, subject_id, title, description, position, created_at) VALUES (?, ?, ?, ?, ?, ?)", [unitId, subjectId, title, description, 1e9, new Date().toISOString()]);
  if (!current || moved || index !== undefined) place("units", "subject_id", subjectId, unitId, index);
  // A move touches two subjects; null tells listeners to refresh everything.
  return { subjectId: moved ? null : subjectId, result: { id: unitId } };
}

function putSkill(userId: string, input: Record<string, unknown>) {
  const id = optionalId(input.id, "skill.id");
  const current = id
    ? db.query<{ unit_id: string; title: string; description: string }, [string, string]>(
        `SELECT skills.* FROM skills JOIN units ON units.id = skills.unit_id
         JOIN subjects ON subjects.id = units.subject_id WHERE skills.id = ? AND subjects.user_id = ?`,
      ).get(id, userId)
    : null;
  if (id && !current) throw notFound("Skill");
  const unitId = optionalId(input.unitId, "skill.unitId") ?? current?.unit_id;
  if (!unitId) throw new AgentError("skill.unitId is required for a new skill", 400, "INVALID");
  const { subject_id: subjectId } = ownedUnit(userId, unitId);
  const title = input.title === undefined && current ? current.title : text(input.title, "skill.title", 120, true);
  const description = input.description === undefined && current ? current.description : text(input.description, "skill.description", 500);
  const index = position(input.position);
  const moved = current && current.unit_id !== unitId;
  if ((!current || moved) && countOf("SELECT COUNT(*) AS count FROM skills WHERE unit_id = ?", unitId) >= MAX_SKILLS_PER_UNIT) {
    throw new AgentError(`At most ${MAX_SKILLS_PER_UNIT} skills per unit`, 400, "LIMIT");
  }

  // `exercises` is the skill's full list when given. Items with an existing id
  // are updated in place (keeping the learner's attempt history); new items
  // are created; existing exercises left out are deleted.
  const exerciseInputs = input.exercises === undefined ? undefined : list(input.exercises, "skill.exercises");
  if (exerciseInputs && exerciseInputs.length > MAX_EXERCISES_PER_SKILL) {
    throw new AgentError(`At most ${MAX_EXERCISES_PER_SKILL} exercises per skill`, 400, "LIMIT");
  }
  const skillId = id ?? crypto.randomUUID();
  const existing = new Set(id ? db.query<{ id: string }, [string]>("SELECT id FROM exercises WHERE skill_id = ?").all(id).map((row) => row.id) : []);
  const exercises = exerciseInputs?.map((value, exerciseIndex) => {
    const where = `skill.exercises[${exerciseIndex}]`;
    const exerciseId = optionalId(record(value, where).id, `${where}.id`);
    if (exerciseId && !existing.has(exerciseId)) throw new AgentError(`${where}.id is not an exercise of this skill. Omit id to create a new exercise`, 404, "NOT_FOUND");
    return { id: exerciseId, exercise: parseExercise(value, where) };
  });

  const now = new Date().toISOString();
  if (current) db.run("UPDATE skills SET unit_id = ?, title = ?, description = ? WHERE id = ?", [unitId, title, description, skillId]);
  else db.run("INSERT INTO skills (id, unit_id, title, description, position, created_at) VALUES (?, ?, ?, ?, ?, ?)", [skillId, unitId, title, description, 1e9, now]);
  if (!current || moved || index !== undefined) place("skills", "unit_id", unitId, skillId, index);

  let exerciseIds = [...existing];
  if (exercises) {
    const kept = new Set(exercises.flatMap((item) => (item.id ? [item.id] : [])));
    for (const exerciseId of existing) if (!kept.has(exerciseId)) db.run("DELETE FROM exercises WHERE id = ?", [exerciseId]);
    exerciseIds = exercises.map(({ id: exerciseId, exercise }, exerciseIndex) => {
      const content = exercise.type === "multiple_choice" ? { options: exercise.options, correctIndex: exercise.correctIndex } : { answers: exercise.answers };
      if (exerciseId) {
        db.run("UPDATE exercises SET type = ?, prompt = ?, content_json = ?, explanation = ?, position = ? WHERE id = ?", [
          exercise.type, exercise.prompt, JSON.stringify(content), exercise.explanation, exerciseIndex, exerciseId,
        ]);
        return exerciseId;
      }
      const newId = crypto.randomUUID();
      db.run("INSERT INTO exercises (id, skill_id, type, prompt, content_json, explanation, position, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)", [
        newId, skillId, exercise.type, exercise.prompt, JSON.stringify(content), exercise.explanation, exerciseIndex, now,
      ]);
      return newId;
    });
  }
  const crossSubject = moved && ownedUnit(userId, current.unit_id).subject_id !== subjectId;
  return { subjectId: crossSubject ? null : subjectId, result: { id: skillId, exerciseIds } };
}

function deleteRecord(userId: string, kind: "subject" | "unit" | "skill", id: string) {
  if (kind === "subject") {
    ownedSubject(userId, id);
    db.run("DELETE FROM subjects WHERE id = ?", [id]);
    return { subjectId: null, result: { deleted: id } };
  }
  const { subject_id: subjectId } = kind === "unit" ? ownedUnit(userId, id) : ownedSkill(userId, id);
  db.run(`DELETE FROM ${kind === "unit" ? "units" : "skills"} WHERE id = ?`, [id]);
  return { subjectId, result: { deleted: id } };
}

function applyCommand(userId: string, command: Record<string, unknown>) {
  const payload = (key: string) => record(command[key], key);
  switch (command.op) {
    case "putSubject": return putSubject(userId, payload("subject"));
    case "putUnit": return putUnit(userId, payload("unit"));
    case "putSkill": return putSkill(userId, payload("skill"));
    case "deleteSubject": return deleteRecord(userId, "subject", requiredId(command.id, "id"));
    case "deleteUnit": return deleteRecord(userId, "unit", requiredId(command.id, "id"));
    case "deleteSkill": return deleteRecord(userId, "skill", requiredId(command.id, "id"));
    default:
      throw new AgentError("command.op must be one of putSubject, putUnit, putSkill, deleteSubject, deleteUnit, deleteSkill", 400, "UNKNOWN_OP");
  }
}

export interface CommitResponse {
  revision: number;
  op: string;
  result: Record<string, unknown>;
  replayed?: true;
}

function hashBody(value: unknown): string {
  return new Bun.CryptoHasher("sha256").update(JSON.stringify(value)).digest("hex");
}

// One operation per commit. `requestId` makes retries safe: the same id with
// the same body replays the stored response instead of applying twice.
// `expectedRevision`, when given, rejects the write if anything changed since
// the agent last read.
export function commit(userId: string, body: unknown): CommitResponse {
  let input: Record<string, unknown>;
  let command: Record<string, unknown>;
  try {
    input = record(body, "Body");
    command = record(input.command, "command");
  } catch (error) {
    throw new AgentError(error instanceof Error ? error.message : "Invalid body", 400, "INVALID");
  }
  const requestId = input.requestId;
  if (requestId !== undefined && (typeof requestId !== "string" || !REQUEST_ID.test(requestId))) {
    throw new AgentError("requestId must be 8-100 letters, digits, - or _ (a UUID works)", 400, "INVALID");
  }
  const bodyHash = hashBody({ expectedRevision: input.expectedRevision ?? null, command });

  if (requestId) {
    const stored = db.query<{ body_hash: string; response_json: string }, [string, string]>(
      "SELECT body_hash, response_json FROM agent_requests WHERE user_id = ? AND request_id = ?",
    ).get(userId, requestId);
    if (stored) {
      if (stored.body_hash !== bodyHash) throw new AgentError("This requestId was already used for a different command. Use a new UUID", 409, "REQUEST_ID_REUSED");
      return { ...(JSON.parse(stored.response_json) as CommitResponse), replayed: true };
    }
  }

  let response!: CommitResponse;
  let subjectId: string | null = null;
  try {
    db.transaction(() => {
      const revision = libraryRevision(userId);
      if (input.expectedRevision !== undefined && input.expectedRevision !== null && input.expectedRevision !== revision) {
        throw new AgentError(`The library changed (revision ${revision}, you expected ${String(input.expectedRevision)}). Reread and reconcile`, 409, "REVISION_CONFLICT", { revision });
      }
      const applied = applyCommand(userId, command);
      subjectId = applied.subjectId;
      response = { revision: bumpRevision(userId, subjectId), op: String(command.op), result: applied.result };
      if (requestId) {
        const now = new Date();
        db.run("DELETE FROM agent_requests WHERE user_id = ? AND created_at < ?", [userId, new Date(now.getTime() - REQUEST_TTL_MS).toISOString()]);
        db.run("INSERT INTO agent_requests (user_id, request_id, body_hash, response_json, created_at) VALUES (?, ?, ?, ?, ?)", [
          userId, requestId, bodyHash, JSON.stringify(response), now.toISOString(),
        ]);
      }
    })();
  } catch (error) {
    if (error instanceof AgentError) throw error;
    // Validation helpers shared with import throw plain Errors.
    const message = error instanceof Error ? error.message : "Invalid command";
    throw new AgentError(message, message.endsWith("not found") ? 404 : 400, message.endsWith("not found") ? "NOT_FOUND" : "INVALID");
  }
  notifyLibrary(userId, { revision: response.revision, subjectId });
  return response;
}

export function report(userId: string, tokenId: string | null, body: unknown): { received: true } {
  const message = text(record(body, "Body").message, "message", 2048, true);
  db.transaction(() => {
    db.run("INSERT INTO agent_reports (id, user_id, token_id, message, created_at) VALUES (?, ?, ?, ?, ?)", [
      crypto.randomUUID(), userId, tokenId, message, new Date().toISOString(),
    ]);
    db.run(
      `DELETE FROM agent_reports WHERE user_id = ? AND id NOT IN (SELECT id FROM agent_reports WHERE user_id = ? ORDER BY created_at DESC LIMIT ${MAX_REPORTS_PER_USER})`,
      [userId, userId],
    );
  })();
  console.warn(`[agent report] user ${userId}: ${message}`);
  return { received: true };
}
