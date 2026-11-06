import {
  isLevel,
  isSubjectIcon,
  isSubjectType,
  libraryStates,
  MAX_NOTES_LENGTH,
  SUBJECT_COLORS,
  type ExerciseType,
  type ExportAttempt,
  type ExportExercise,
  type ExportFile,
  type ExportFolder,
  type ExportSkill,
  type ExportStats,
  type ExportSubject,
  type ImportResult,
  type SubjectColor,
} from "@halolesson/shared";
import { db } from "./db";
import { getLibrary } from "./library";
import { getSubject, nextPosition, recordLevel } from "./subjects";

export const HEX_COLOR = /^#[0-9a-f]{6}$/i;
const MAX_SUBJECTS = 100;
const MAX_EXERCISES = 20_000;

interface SubjectRow {
  id: string;
  type: string;
  level: number | null;
  notes: string;
  name: string;
  description: string;
  color: SubjectColor;
  gradient_start: string;
  gradient_end: string;
  icon: string | null;
  position: number;
  archived_at: string | null;
}

interface ExerciseRow {
  id: string;
  type: ExerciseType;
  prompt: string;
  content_json: string;
  explanation: string;
}

interface ProgressRow {
  stars: number;
  mastery: number;
  correct_attempts: number;
  total_attempts: number;
  last_practiced_at: string | null;
}

export function getExportStats(userId: string): ExportStats {
  return db
    .query<ExportStats, [string]>(`
      SELECT COUNT(DISTINCT subjects.id) AS subjectCount, COUNT(DISTINCT units.id) AS unitCount,
        COUNT(DISTINCT skills.id) AS skillCount, COUNT(DISTINCT exercises.id) AS exerciseCount
      FROM subjects
      LEFT JOIN units ON units.subject_id = subjects.id
      LEFT JOIN skills ON skills.unit_id = units.id
      LEFT JOIN exercises ON exercises.skill_id = skills.id
      WHERE subjects.user_id = ?
    `)
    .get(userId)!;
}

function exportExercise(row: ExerciseRow): ExportExercise {
  const content = JSON.parse(row.content_json) as { options?: string[]; correctIndex?: number; answers?: string[] };
  return row.type === "multiple_choice"
    ? { type: row.type, prompt: row.prompt, options: content.options ?? [], correctIndex: content.correctIndex ?? 0, explanation: row.explanation }
    : { type: row.type, prompt: row.prompt, answers: content.answers ?? [], explanation: row.explanation };
}

function exportSubject(userId: string, row: SubjectRow, includeProgress: boolean): ExportSubject {
  const { units } = getSubject(userId, row.id);
  return {
    type: isSubjectType(row.type) ? row.type : "subject",
    // Self-rating and notes are personal, like skill progress: backups only.
    ...(includeProgress ? {
      level: row.level,
      notes: row.notes,
      levelHistory: db.query<{ level: number | null; created_at: string }, [string]>("SELECT level, created_at FROM level_history WHERE subject_id = ? ORDER BY created_at").all(row.id).map((point) => ({ level: point.level, at: point.created_at })),
    } : {}),
    name: row.name,
    description: row.description,
    color: row.color,
    gradientStart: row.gradient_start,
    gradientEnd: row.gradient_end,
    icon: isSubjectIcon(row.icon) ? row.icon : null,
    units: units.map((unit) => ({
      title: unit.title,
      description: unit.description,
      skills: unit.skills.map((skill) => {
        const exported: ExportSkill = {
          title: skill.title,
          description: skill.description,
          exercises: db
            .query<ExerciseRow, [string]>("SELECT * FROM exercises WHERE skill_id = ? ORDER BY position, created_at")
            .all(skill.id)
            .map((exercise) => {
              const exported = exportExercise(exercise);
              if (includeProgress) {
                exported.attempts = db
                  .query<{ created_at: string; is_correct: number; duration_ms: number | null; mastery_after: number | null }, [string, string]>("SELECT created_at, is_correct, duration_ms, mastery_after FROM attempts WHERE user_id = ? AND exercise_id = ? ORDER BY created_at")
                  .all(userId, exercise.id)
                  .map((attempt) => ({ at: attempt.created_at, correct: attempt.is_correct === 1, durationMs: attempt.duration_ms, masteryAfter: attempt.mastery_after }));
              }
              return exported;
            }),
        };
        if (includeProgress) {
          const progress = db
            .query<ProgressRow, [string, string]>("SELECT * FROM skill_progress WHERE user_id = ? AND skill_id = ?")
            .get(userId, skill.id);
          if (progress) {
            exported.progress = {
              stars: progress.stars,
              mastery: progress.mastery,
              correctAttempts: progress.correct_attempts,
              totalAttempts: progress.total_attempts,
              lastPracticedAt: progress.last_practiced_at,
            };
          }
        }
        return exported;
      }),
    })),
  };
}

// Full backup keeps practice progress and the library layout (folders, order,
// icons, archive) but leaves out the trash; a single shared subject is content only.
export function buildExport(userId: string, subjectId?: string): ExportFile {
  const exportedAt = new Date().toISOString();
  if (subjectId) {
    const rows = db.query<SubjectRow, [string, string]>("SELECT * FROM subjects WHERE user_id = ? AND id = ?").all(userId, subjectId);
    if (rows.length === 0) throw new Error("Subject not found");
    return { format: "halolesson", formatVersion: 1, exportedAt, subjects: rows.map((row) => exportSubject(userId, row, false)) };
  }

  const library = getLibrary(userId);
  const states = libraryStates(library);
  const kept = library.folders.filter((folder) => states.get(folder.id) !== "trashed");
  // Parents first, so each folder's `parent` points at an earlier entry.
  const ordered: typeof kept = [];
  for (let parents: Array<string | null> = [null]; parents.length > 0;) {
    const level = kept.filter((folder) => parents.includes(folder.parentId)).sort((a, b) => a.position - b.position || a.createdAt.localeCompare(b.createdAt));
    ordered.push(...level);
    parents = level.map((folder) => folder.id);
  }
  const index = new Map(ordered.map((folder, at) => [folder.id, at]));
  const folders: ExportFolder[] = ordered.map((folder) => ({
    name: folder.name,
    color: folder.color,
    parent: folder.parentId === null ? null : index.get(folder.parentId)!,
    position: folder.position,
    archivedAt: folder.archivedAt,
  }));
  const folderOf = new Map(library.subjects.map((subject) => [subject.id, subject.folderId]));
  const rows = db
    .query<SubjectRow, [string]>("SELECT * FROM subjects WHERE user_id = ? AND deleted_at IS NULL ORDER BY created_at")
    .all(userId)
    .filter((row) => states.get(row.id) !== "trashed");
  const subjects = rows.map((row) => {
    const parent = folderOf.get(row.id) ?? null;
    return {
      ...exportSubject(userId, row, true),
      folder: parent === null ? null : index.get(parent)!,
      position: row.position,
      archivedAt: row.archived_at,
    };
  });
  return { format: "halolesson", formatVersion: 1, exportedAt, folders, subjects };
}

export function record(value: unknown, where: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${where} must be an object`);
  return value as Record<string, unknown>;
}

export function list(value: unknown, where: string): unknown[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) throw new Error(`${where} must be a list`);
  return value;
}

export function text(value: unknown, where: string, max: number, required = false): string {
  const result = typeof value === "string" ? value.trim() : "";
  if (required && !result) throw new Error(`${where} is required`);
  if (result.length > max) throw new Error(`${where} must be ${max} characters or fewer`);
  return result;
}

function strings(value: unknown, where: string): string[] {
  return list(value, where).map((item, index) => text(item, `${where} ${index + 1}`, 500, true));
}

export function parseExercise(value: unknown, where: string): ExportExercise {
  const input = record(value, where);
  const prompt = text(input.prompt, `${where} prompt`, 2000, true);
  const explanation = text(input.explanation, `${where} explanation`, 2000);
  if (input.type === "multiple_choice") {
    const options = strings(input.options, `${where} option`);
    const correctIndex = input.correctIndex;
    if (options.length < 2) throw new Error(`${where} needs at least 2 options`);
    if (typeof correctIndex !== "number" || !Number.isInteger(correctIndex) || correctIndex < 0 || correctIndex >= options.length) {
      throw new Error(`${where} correctIndex must point to one of its options`);
    }
    return { type: "multiple_choice", prompt, options, correctIndex, explanation };
  }
  if (input.type === "free_text") {
    const answers = strings(input.answers, `${where} answer`);
    if (answers.length === 0) throw new Error(`${where} needs at least one accepted answer`);
    return { type: "free_text", prompt, answers, explanation };
  }
  throw new Error(`${where} type must be multiple_choice or free_text`);
}

function parseProgress(value: unknown): ExportSkill["progress"] {
  if (!value || typeof value !== "object") return undefined;
  const input = value as Record<string, unknown>;
  const count = (item: unknown) => (typeof item === "number" && Number.isInteger(item) && item >= 0 ? item : 0);
  const mastery = typeof input.mastery === "number" ? Math.max(0, Math.min(1, input.mastery)) : 0;
  return {
    stars: Math.min(3, count(input.stars)),
    mastery,
    correctAttempts: count(input.correctAttempts),
    totalAttempts: count(input.totalAttempts),
    lastPracticedAt: date(input.lastPracticedAt),
  };
}

// Statistics history is optional: malformed entries are skipped, not fatal.
function parseLevelHistory(value: unknown): ExportSubject["levelHistory"] {
  if (!Array.isArray(value)) return undefined;
  return value.flatMap((item) => {
    const point = item as Record<string, unknown> | null;
    const at = date(point?.at);
    const level = point?.level ?? null;
    return at && (level === null || isLevel(level)) ? [{ level, at }] : [];
  });
}

function parseAttempts(value: unknown): ExportAttempt[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return value.flatMap((item) => {
    const attempt = item as Record<string, unknown> | null;
    const at = date(attempt?.at);
    if (!at || typeof attempt?.correct !== "boolean") return [];
    const ms = attempt.durationMs;
    const mastery = attempt.masteryAfter;
    return [{
      at,
      correct: attempt.correct,
      durationMs: typeof ms === "number" && Number.isFinite(ms) && ms >= 0 ? Math.round(ms) : null,
      masteryAfter: typeof mastery === "number" && mastery >= 0 && mastery <= 1 ? mastery : null,
    }];
  });
}

const date = (value: unknown) => (typeof value === "string" && !Number.isNaN(Date.parse(value)) ? value : null);
const position = (value: unknown, fallback: number) => (typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : fallback);

// `limit` is how many folders the reference may point into (null always works).
function folderRef(value: unknown, limit: number, where: string): number | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0 || value >= limit) throw new Error(`${where} points to a folder that isn't in the file`);
  return value;
}

function parseFolder(value: unknown, index: number): ExportFolder {
  const where = `Folder ${index + 1}`;
  const input = record(value, where);
  return {
    name: text(input.name, `${where} name`, 80, true),
    color: typeof input.color === "string" && HEX_COLOR.test(input.color) ? input.color : "#7c5cff",
    parent: folderRef(input.parent, index, where),
    position: position(input.position, index),
    archivedAt: date(input.archivedAt),
  };
}

function parseSubject(value: unknown, where: string, folderCount = 0, index = 0): ExportSubject {
  const input = record(value, where);
  const color = SUBJECT_COLORS.includes(input.color as SubjectColor) ? (input.color as SubjectColor) : "green";
  const type = isSubjectType(input.type) ? input.type : "subject";
  return {
    type,
    level: isLevel(input.level) ? input.level : null,
    notes: text(input.notes, `${where} notes`, MAX_NOTES_LENGTH),
    levelHistory: parseLevelHistory(input.levelHistory),
    name: text(input.name, `${where} name`, 80, true),
    description: text(input.description, `${where} description`, 500),
    color,
    gradientStart: typeof input.gradientStart === "string" && HEX_COLOR.test(input.gradientStart) ? input.gradientStart : "#58cc02",
    gradientEnd: typeof input.gradientEnd === "string" && HEX_COLOR.test(input.gradientEnd) ? input.gradientEnd : "#1cb0f6",
    icon: isSubjectIcon(input.icon) ? input.icon : null,
    folder: folderRef(input.folder, folderCount, where),
    position: position(input.position, index),
    archivedAt: date(input.archivedAt),
    // A tracker holds no units, whatever the file says.
    units: (type === "tracker" ? [] : list(input.units, `${where} units`)).map((unitValue, unitIndex) => {
      const unitWhere = `${where} unit ${unitIndex + 1}`;
      const unit = record(unitValue, unitWhere);
      return {
        title: text(unit.title, `${unitWhere} title`, 120, true),
        description: text(unit.description, `${unitWhere} description`, 500),
        skills: list(unit.skills, `${unitWhere} skills`).map((skillValue, skillIndex) => {
          const skillWhere = `${unitWhere} skill ${skillIndex + 1}`;
          const skill = record(skillValue, skillWhere);
          return {
            title: text(skill.title, `${skillWhere} title`, 120, true),
            description: text(skill.description, `${skillWhere} description`, 500),
            exercises: list(skill.exercises, `${skillWhere} exercises`).map((exercise, index) => ({
              ...parseExercise(exercise, `${skillWhere} exercise ${index + 1}`),
              attempts: parseAttempts((exercise as Record<string, unknown>).attempts),
            })),
            progress: parseProgress(skill.progress),
          };
        }),
      };
    }),
  };
}

// Accepts a haloLesson export file, or a bare `{ subject, units }` object for
// one subject. Everything is validated before anything is
// written, and imports always create new subjects instead of overwriting.
export function parseImport(value: unknown): { folders: ExportFolder[]; subjects: ExportSubject[] } {
  const input = record(value, "File");
  let subjects: ExportSubject[];
  let folders: ExportFolder[] = [];
  if (input.format === "halolesson") {
    if (input.formatVersion !== 1) throw new Error("This export was made by a newer haloLesson version");
    folders = list(input.folders, "folders").map(parseFolder);
    if (folders.length > MAX_SUBJECTS) throw new Error(`Import at most ${MAX_SUBJECTS} folders at once`);
    subjects = list(input.subjects, "subjects").map((subject, index) => parseSubject(subject, `Subject ${index + 1}`, folders.length, index));
  } else if (input.subject !== undefined) {
    subjects = [parseSubject({ ...record(input.subject, "subject"), units: input.units }, "Subject")];
  } else {
    throw new Error("This doesn't look like a haloLesson export or lesson file");
  }
  if (subjects.length === 0) throw new Error("The file has no subjects to import");
  if (subjects.length > MAX_SUBJECTS) throw new Error(`Import at most ${MAX_SUBJECTS} subjects at once`);
  const exerciseCount = subjects.flatMap((subject) => subject.units.flatMap((unit) => unit.skills.flatMap((skill) => skill.exercises))).length;
  if (exerciseCount > MAX_EXERCISES) throw new Error(`Import at most ${MAX_EXERCISES} exercises at once`);
  return { folders, subjects };
}

// Imported folders are always new too. Top-level items go after whatever the
// library already has, keeping their order from the file.
export function importSubjects(userId: string, subjects: ExportSubject[], folders: ExportFolder[] = []): ImportResult {
  let skillCount = 0;
  let exerciseCount = 0;
  const ids: string[] = [];
  db.transaction(() => {
    const offset = nextPosition(userId, null);
    const folderIds: string[] = [];
    for (const folder of folders) {
      const now = new Date().toISOString();
      const folderId = crypto.randomUUID();
      folderIds.push(folderId);
      db.run(
        "INSERT INTO folders (id, user_id, parent_id, name, color, position, archived_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [folderId, userId, folder.parent === null ? null : folderIds[folder.parent]!, folder.name, folder.color, folder.parent === null ? offset + folder.position : folder.position, folder.archivedAt, now, now],
      );
    }
    subjects.forEach((subject, subjectIndex) => {
      const now = new Date().toISOString();
      const subjectId = crypto.randomUUID();
      ids.push(subjectId);
      const folder = subject.folder ?? null;
      const at = subject.position ?? subjectIndex;
      db.run(
        "INSERT INTO subjects (id, user_id, type, level, notes, name, description, color, gradient_start, gradient_end, icon, folder_id, position, archived_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [subjectId, userId, subject.type ?? "subject", subject.level ?? null, subject.notes ?? "", subject.name, subject.description, subject.color, subject.gradientStart, subject.gradientEnd, subject.icon ?? null, folder === null ? null : folderIds[folder]!, folder === null ? offset + at : at, subject.archivedAt ?? null, now, now],
      );
      const history = subject.levelHistory?.length ? subject.levelHistory : subject.level != null ? [{ level: subject.level, at: now }] : [];
      for (const point of history) recordLevel(userId, subjectId, point.level, point.at);
      subject.units.forEach((unit, unitIndex) => {
        const unitId = crypto.randomUUID();
        db.run("INSERT INTO units (id, subject_id, title, description, position, created_at) VALUES (?, ?, ?, ?, ?, ?)", [
          unitId, subjectId, unit.title, unit.description, unitIndex, now,
        ]);
        unit.skills.forEach((skill, skillIndex) => {
          const skillId = crypto.randomUUID();
          skillCount += 1;
          db.run("INSERT INTO skills (id, unit_id, title, description, position, created_at) VALUES (?, ?, ?, ?, ?, ?)", [
            skillId, unitId, skill.title, skill.description, skillIndex, now,
          ]);
          skill.exercises.forEach((exercise, exerciseIndex) => {
            exerciseCount += 1;
            const content = exercise.type === "multiple_choice"
              ? { options: exercise.options, correctIndex: exercise.correctIndex }
              : { answers: exercise.answers };
            const exerciseId = crypto.randomUUID();
            db.run(
              "INSERT INTO exercises (id, skill_id, type, prompt, content_json, explanation, position, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
              [exerciseId, skillId, exercise.type, exercise.prompt, JSON.stringify(content), exercise.explanation, exerciseIndex, now],
            );
            for (const attempt of exercise.attempts ?? []) {
              db.run(
                "INSERT INTO attempts (id, user_id, exercise_id, answer_json, is_correct, duration_ms, mastery_after, created_at) VALUES (?, ?, ?, 'null', ?, ?, ?, ?)",
                [crypto.randomUUID(), userId, exerciseId, attempt.correct ? 1 : 0, attempt.durationMs ?? null, attempt.masteryAfter ?? null, attempt.at],
              );
            }
          });
          if (skill.progress && skill.progress.totalAttempts > 0) {
            db.run(
              "INSERT INTO skill_progress (user_id, skill_id, stars, mastery, correct_attempts, total_attempts, last_practiced_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
              [userId, skillId, skill.progress.stars, skill.progress.mastery, Math.min(skill.progress.correctAttempts, skill.progress.totalAttempts), skill.progress.totalAttempts, skill.progress.lastPracticedAt],
            );
          }
        });
      });
    });
  })();
  return { subjects: ids.map((id) => getSubject(userId, id).subject), skillCount, exerciseCount };
}
