import {
  BLANK,
  DEFAULT_HEARTS,
  EXERCISE_TYPES,
  DEFAULT_SESSION_SIZE,
  MAX_HEARTS,
  MAX_SESSION_SIZE,
  isLevel,
  isTier,
  MAX_CONCEPT_LENGTH,
  MAX_CONCEPTS,
  TIERS,
  isSubjectIcon,
  isSubjectType,
  libraryStates,
  MAX_LINKS_PER_SKILL,
  MAX_NOTES_LENGTH,
  SUBJECT_COLORS,
  type ExerciseType,
  type ExportAttempt,
  type ExportExercise,
  EXPORT_FORMAT_VERSION,
  type ExportFile,
  type ExportKind,
  type ExportFolder,
  type ExportSkill,
  type Tier,
  type ExportStats,
  type ExportSubject,
  type ImportChoice,
  type ImportOptions,
  type ImportPreview,
  type ImportResult,
  type SubjectColor,
} from "@halolesson/shared";
import { db } from "./db";
import { contentFields, contentJson } from "./exercises";
import { getLibrary } from "./library";
import { getSubject, nextPosition, recordLevel } from "./subjects";

export const HEX_COLOR = /^#[0-9a-f]{6}$/i;
const MAX_SUBJECTS = 100;
const MAX_EXERCISES = 20_000;

interface SubjectRow {
  id: string;
  origin_id: string | null;
  unlock_in_order: number;
  unlock_tier: number;
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
  origin_id: string | null;
  type: ExerciseType;
  prompt: string;
  content_json: string;
  explanation: string;
  tier: number;
  concepts_json: string;
}

interface ProgressRow {
  tiers_cleared: number;
  expert_cleared_at: string | null;
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

// Ids in a file are the content's lineage: the id it had where it was first
// exported. Two copies of one share in a backup would collide, so a repeat
// falls back to the local id.
class FileIds {
  private used = new Set<string>();
  claim(lineage: string | null, local: string): string {
    const id = lineage && !this.used.has(lineage) ? lineage : local;
    this.used.add(id);
    return id;
  }
}

const lineageOf = (table: "units" | "skills", ids: string[]) =>
  new Map(ids.length ? db.query<{ id: string; origin_id: string | null }, string[]>(`SELECT id, origin_id FROM ${table} WHERE id IN (${ids.map(() => "?").join(", ")})`).all(...ids).map((row) => [row.id, row.origin_id]) : []);

function exportExercise(row: ExerciseRow): ExportExercise {
  const concepts = JSON.parse(row.concepts_json) as string[];
  const shared = { tier: TIERS[row.tier] ?? "easy", ...(concepts.length ? { concepts } : {}) };
  return { ...shared, type: row.type, prompt: row.prompt, ...contentFields(row.type, row.content_json), explanation: row.explanation };
}

function exportSubject(userId: string, row: SubjectRow, includeProgress: boolean, ids: FileIds): ExportSubject {
  const { units, links } = getSubject(userId, row.id);
  const unitOrigins = lineageOf("units", units.map((unit) => unit.id));
  const skillOrigins = lineageOf("skills", units.flatMap((unit) => unit.skills.map((skill) => skill.id)));
  const subjectFileId = ids.claim(row.origin_id, row.id);
  const unitFileIds = new Map(units.map((unit) => [unit.id, ids.claim(unitOrigins.get(unit.id) ?? null, unit.id)]));
  const skillFileIds = new Map(units.flatMap((unit) => unit.skills).map((skill) => [skill.id, ids.claim(skillOrigins.get(skill.id) ?? null, skill.id)]));
  // Each link is listed once, on its first skill.
  const linksOf = new Map<string, string[]>();
  for (const [a, b] of links) linksOf.set(a, [...(linksOf.get(a) ?? []), skillFileIds.get(b)!]);
  return {
    id: subjectFileId,
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
    unlockInOrder: row.unlock_in_order === 1,
    unlockTier: TIERS[row.unlock_tier] ?? "easy",
    units: units.map((unit) => ({
      id: unitFileIds.get(unit.id),
      title: unit.title,
      description: unit.description,
      skills: unit.skills.map((skill) => {
        const exported: ExportSkill = {
          id: skillFileIds.get(skill.id),
          title: skill.title,
          description: skill.description,
          ...(skill.start ? { start: true } : {}),
          ...(linksOf.has(skill.id) ? { links: linksOf.get(skill.id) } : {}),
          sessionSize: skill.sessionSize,
          hearts: skill.hearts,
          exercises: db
            .query<ExerciseRow, [string]>("SELECT * FROM exercises WHERE skill_id = ? ORDER BY position, created_at")
            .all(skill.id)
            .map((exercise) => {
              const exported = { id: ids.claim(exercise.origin_id, exercise.id), ...exportExercise(exercise) };
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
              tiersCleared: progress.tiers_cleared,
              expertClearedAt: progress.expert_cleared_at,
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
    return { format: "halolesson", formatVersion: EXPORT_FORMAT_VERSION, kind: "share", exportedAt, subjects: rows.map((row) => exportSubject(userId, row, false, new FileIds())) };
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
    .query<SubjectRow, [string]>("SELECT * FROM subjects WHERE user_id = ? AND deleted_at IS NULL ORDER BY created_at, rowid")
    .all(userId)
    .filter((row) => states.get(row.id) !== "trashed");
  const ids = new FileIds();
  const subjects = rows.map((row) => {
    const parent = folderOf.get(row.id) ?? null;
    return {
      ...exportSubject(userId, row, true, ids),
      folder: parent === null ? null : index.get(parent)!,
      position: row.position,
      archivedAt: row.archived_at,
    };
  });
  return { format: "halolesson", formatVersion: EXPORT_FORMAT_VERSION, kind: "backup", exportedAt, folders, subjects };
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

function parseConcepts(value: unknown, where: string): string[] {
  if (value === undefined || value === null) return [];
  const concepts = strings(value, `${where} concept`).map((concept) => {
    if (concept.length > MAX_CONCEPT_LENGTH) throw new Error(`${where} concepts must be ${MAX_CONCEPT_LENGTH} characters or fewer`);
    return concept;
  });
  const unique = [...new Map(concepts.map((concept) => [concept.toLocaleLowerCase(), concept])).values()];
  if (unique.length > MAX_CONCEPTS) throw new Error(`${where} can list at most ${MAX_CONCEPTS} concepts`);
  return unique;
}

export function parseExercise(value: unknown, where: string): ExportExercise {
  const input = record(value, where);
  const prompt = text(input.prompt, `${where} prompt`, 2000, true);
  const explanation = text(input.explanation, `${where} explanation`, 2000);
  if (input.tier !== undefined && input.tier !== null && !isTier(input.tier)) throw new Error(`${where} tier must be one of ${TIERS.join(", ")}`);
  const shared = { tier: isTier(input.tier) ? input.tier : "easy" as const, concepts: parseConcepts(input.concepts, where), explanation };
  if (input.type === "multiple_choice") {
    const options = strings(input.options, `${where} option`);
    const correctIndex = input.correctIndex;
    if (options.length < 2) throw new Error(`${where} needs at least 2 options`);
    if (typeof correctIndex !== "number" || !Number.isInteger(correctIndex) || correctIndex < 0 || correctIndex >= options.length) {
      throw new Error(`${where} correctIndex must point to one of its options`);
    }
    return { ...shared, type: "multiple_choice", prompt, options, correctIndex };
  }
  if (input.type === "free_text") {
    const answers = strings(input.answers, `${where} answer`);
    if (answers.length === 0) throw new Error(`${where} needs at least one accepted answer`);
    return { ...shared, type: "free_text", prompt, answers };
  }
  if (input.type === "order") {
    const items = strings(input.items, `${where} item`);
    if (items.length < 2) throw new Error(`${where} needs at least 2 items to order`);
    return { ...shared, type: "order", prompt, items };
  }
  if (input.type === "match") {
    const pairs = list(input.pairs, `${where} pairs`).map((pair, index) => {
      const sides = strings(pair, `${where} pair ${index + 1} side`);
      if (sides.length !== 2) throw new Error(`${where} pair ${index + 1} must be [left, right]`);
      return sides as [string, string];
    });
    if (pairs.length < 2) throw new Error(`${where} needs at least 2 pairs to match`);
    if (new Set(pairs.map(([left]) => left.toLocaleLowerCase())).size !== pairs.length) throw new Error(`${where} left items must all differ`);
    return { ...shared, type: "match", prompt, pairs };
  }
  if (input.type === "fill_blanks") {
    const blanks = list(input.blanks, `${where} blanks`).map((answers, index) => {
      const accepted = strings(answers, `${where} blank ${index + 1} answer`);
      if (!accepted.length) throw new Error(`${where} blank ${index + 1} needs at least one accepted answer`);
      return accepted;
    });
    const gaps = prompt.split(BLANK).length - 1;
    if (!gaps) throw new Error(`${where} prompt needs at least one ${BLANK} blank`);
    if (gaps !== blanks.length) throw new Error(`${where} prompt has ${gaps} ${BLANK} blanks but ${blanks.length} lists of answers`);
    return { ...shared, type: "fill_blanks", prompt, blanks };
  }
  throw new Error(`${where} type must be one of ${EXERCISE_TYPES.join(", ")}`);
}

function parseProgress(value: unknown): ExportSkill["progress"] {
  if (!value || typeof value !== "object") return undefined;
  const input = value as Record<string, unknown>;
  const count = (item: unknown) => (typeof item === "number" && Number.isInteger(item) && item >= 0 ? item : 0);
  const mastery = typeof input.mastery === "number" ? Math.max(0, Math.min(1, input.mastery)) : 0;
  // Files from before tiers have stars instead: any star meant the skill was finished.
  const tiersCleared = input.tiersCleared === undefined ? Math.min(1, count(input.stars)) : Math.min(TIERS.length, count(input.tiersCleared));
  return {
    tiersCleared,
    expertClearedAt: tiersCleared === TIERS.length ? date(input.expertClearedAt) : null,
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

const FILE_ID = /^[A-Za-z0-9_-]{1,100}$/;
// Ids are optional (format 1 has none); a malformed one is dropped, not fatal.
const fileId = (value: unknown) => (typeof value === "string" && FILE_ID.test(value) ? value : undefined);

// Out-of-range skill settings fall back to the defaults instead of failing the import.
const setting = (value: unknown, max: number) => (typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= max ? value : undefined);
const tierIndex = (tier: Tier | undefined) => Math.max(0, TIERS.indexOf(tier ?? "easy"));
const tierOf = (exercise: ExportExercise) => tierIndex(exercise.tier);
const conceptsJson = (exercise: ExportExercise) => JSON.stringify(exercise.concepts ?? []);

function writeSkillSettings(skillId: string, skill: ExportSkill): void {
  db.run("UPDATE skills SET session_size = ?, hearts = ? WHERE id = ?", [skill.sessionSize ?? DEFAULT_SESSION_SIZE, skill.hearts ?? DEFAULT_HEARTS, skillId]);
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
    id: fileId(input.id),
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
    unlockInOrder: input.unlockInOrder === true,
    unlockTier: isTier(input.unlockTier) ? input.unlockTier : "easy",
    folder: folderRef(input.folder, folderCount, where),
    position: position(input.position, index),
    archivedAt: date(input.archivedAt),
    // A tracker holds no units, whatever the file says.
    units: (type === "tracker" ? [] : list(input.units, `${where} units`)).map((unitValue, unitIndex) => {
      const unitWhere = `${where} unit ${unitIndex + 1}`;
      const unit = record(unitValue, unitWhere);
      return {
        id: fileId(unit.id),
        title: text(unit.title, `${unitWhere} title`, 120, true),
        description: text(unit.description, `${unitWhere} description`, 500),
        skills: list(unit.skills, `${unitWhere} skills`).map((skillValue, skillIndex) => {
          const skillWhere = `${unitWhere} skill ${skillIndex + 1}`;
          const skill = record(skillValue, skillWhere);
          return {
            id: fileId(skill.id),
            title: text(skill.title, `${skillWhere} title`, 120, true),
            description: text(skill.description, `${skillWhere} description`, 500),
            start: skill.start === true,
            links: Array.isArray(skill.links) ? skill.links.flatMap((link) => fileId(link) ?? []).slice(0, MAX_LINKS_PER_SKILL) : [],
            sessionSize: setting(skill.sessionSize, MAX_SESSION_SIZE),
            hearts: setting(skill.hearts, MAX_HEARTS),
            exercises: list(skill.exercises, `${skillWhere} exercises`).map((exercise, index) => ({
              id: fileId((exercise as Record<string, unknown>).id),
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
export interface ParsedImport {
  kind: ExportKind;
  formatVersion: number;
  exportedAt: string | null;
  folders: ExportFolder[];
  subjects: ExportSubject[];
}

export function parseImport(value: unknown): ParsedImport {
  const input = record(value, "File");
  let subjects: ExportSubject[];
  let folders: ExportFolder[] = [];
  let formatVersion = 0;
  if (input.format === "halolesson") {
    formatVersion = Number(input.formatVersion);
    if (formatVersion !== 1 && formatVersion !== EXPORT_FORMAT_VERSION) {
      throw new Error(formatVersion > EXPORT_FORMAT_VERSION ? "This export was made by a newer haloLesson version. Update haloLesson to import it" : "Unknown export format version");
    }
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
  const kind: ExportKind = input.kind === "backup" || input.kind === "share" ? input.kind : folders.length ? "backup" : "share";
  return { kind, formatVersion, exportedAt: date(input.exportedAt), folders, subjects };
}

// Your existing copy of a file's subject: same type, not in the trash, and
// either the very item that was exported or a copy made from it.
function findMatch(userId: string, subject: ExportSubject): { id: string; name: string } | null {
  if (!subject.id) return null;
  return db.query<{ id: string; name: string }, [string, string, string, string]>(`
    SELECT id, name FROM subjects WHERE user_id = ? AND type = ? AND deleted_at IS NULL AND (id = ? OR origin_id = ?)
    ORDER BY updated_at DESC LIMIT 1
  `).get(userId, subject.type ?? "subject", subject.id, subject.id) ?? null;
}

export function previewImport(userId: string, parsed: ParsedImport): ImportPreview {
  const folderPath = (index: number | null | undefined): string[] => {
    const path: string[] = [];
    for (let at = index ?? null; at !== null; at = parsed.folders[at]!.parent) path.unshift(parsed.folders[at]!.name);
    return path;
  };
  return {
    kind: parsed.kind,
    formatVersion: parsed.formatVersion,
    exportedAt: parsed.exportedAt,
    items: parsed.subjects.map((subject, index) => ({
      index,
      type: subject.type ?? "subject",
      name: subject.name,
      description: subject.description,
      color: subject.color,
      gradientStart: subject.gradientStart,
      icon: subject.icon ?? null,
      unitCount: subject.units.length,
      skillCount: subject.units.reduce((sum, unit) => sum + unit.skills.length, 0),
      exerciseCount: subject.units.reduce((sum, unit) => sum + unit.skills.reduce((total, skill) => total + skill.exercises.length, 0), 0),
      folderPath: folderPath(subject.folder),
      match: findMatch(userId, subject),
    })),
  };
}

export function checkImportOptions(value: unknown, count: number): ImportOptions {
  if (value === undefined || value === null) return {};
  const input = record(value, "options");
  const choices = list(input.choices, "options.choices").map((choice, index) => {
    if (choice !== "add" && choice !== "update" && choice !== "skip") throw new Error(`options.choices ${index + 1} must be add, update or skip`);
    return choice as ImportChoice;
  });
  if (choices.length > count) throw new Error("options.choices has more entries than the file has items");
  const folderId = input.folderId === undefined || input.folderId === null ? null : String(input.folderId);
  return { choices, folderId };
}


// "Update mine": the existing subject takes the file's content. Units, skills
// and exercises with the same lineage are updated in place, so your progress
// and answers on them stay; ones the file no longer has are removed.
// The subject's links become exactly the file's: `skillIds` maps file skill
// ids to the skills they were written to. Links to unknown skills are dropped.
function writeLinks(subjectId: string, subject: ExportSubject, skillIds: Map<string, string>, now: string) {
  db.run("DELETE FROM skill_links WHERE subject_id = ?", [subjectId]);
  const degree = new Map<string, number>();
  for (const skill of subject.units.flatMap((unit) => unit.skills)) {
    const from = skill.id ? skillIds.get(skill.id) : undefined;
    for (const link of skill.links ?? []) {
      const to = skillIds.get(link);
      if (!from || !to || from === to) continue;
      const [a, b] = from < to ? [from, to] : [to, from];
      if ((degree.get(a) ?? 0) >= MAX_LINKS_PER_SKILL || (degree.get(b) ?? 0) >= MAX_LINKS_PER_SKILL) continue;
      if (db.query("INSERT OR IGNORE INTO skill_links (subject_id, a, b, created_at) VALUES (?, ?, ?, ?)").run(subjectId, a, b, now).changes === 0) continue;
      degree.set(a, (degree.get(a) ?? 0) + 1);
      degree.set(b, (degree.get(b) ?? 0) + 1);
    }
  }
}

function updateFromFile(subjectId: string, subject: ExportSubject) {
  const now = new Date().toISOString();
  db.run("UPDATE subjects SET name = ?, description = ?, color = ?, gradient_start = ?, gradient_end = ?, icon = ?, unlock_in_order = ?, unlock_tier = ?, updated_at = ? WHERE id = ?", [
    subject.name, subject.description, subject.color, subject.gradientStart, subject.gradientEnd, subject.icon ?? null, subject.unlockInOrder ? 1 : 0, tierIndex(subject.unlockTier), now, subjectId,
  ]);
  const written = new Map<string, string>();
  type Row = { id: string; lineage: string };
  const units = new Map(db.query<Row, [string]>("SELECT id, COALESCE(origin_id, id) AS lineage FROM units WHERE subject_id = ?").all(subjectId).map((row) => [row.lineage, row.id]));
  const skills = new Map(db.query<Row, [string]>("SELECT skills.id, COALESCE(skills.origin_id, skills.id) AS lineage FROM skills JOIN units ON units.id = skills.unit_id WHERE units.subject_id = ?").all(subjectId).map((row) => [row.lineage, row.id]));
  const exercises = new Map(db.query<Row, [string]>(`SELECT exercises.id, COALESCE(exercises.origin_id, exercises.id) AS lineage FROM exercises
    JOIN skills ON skills.id = exercises.skill_id JOIN units ON units.id = skills.unit_id WHERE units.subject_id = ?`).all(subjectId).map((row) => [row.lineage, row.id]));
  const kept = { units: new Set<string>(), skills: new Set<string>(), exercises: new Set<string>() };
  subject.units.forEach((unit, unitIndex) => {
    let unitId = unit.id ? units.get(unit.id) : undefined;
    if (unitId) db.run("UPDATE units SET title = ?, description = ?, position = ? WHERE id = ?", [unit.title, unit.description, unitIndex, unitId]);
    else {
      unitId = crypto.randomUUID();
      db.run("INSERT INTO units (id, subject_id, title, description, position, origin_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)", [unitId, subjectId, unit.title, unit.description, unitIndex, unit.id ?? null, now]);
    }
    kept.units.add(unitId);
    unit.skills.forEach((skill, skillIndex) => {
      let skillId = skill.id ? skills.get(skill.id) : undefined;
      if (skillId) db.run("UPDATE skills SET unit_id = ?, title = ?, description = ?, position = ?, is_start = ? WHERE id = ?", [unitId!, skill.title, skill.description, skillIndex, skill.start ? 1 : 0, skillId]);
      else {
        skillId = crypto.randomUUID();
        db.run("INSERT INTO skills (id, unit_id, title, description, position, is_start, origin_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)", [skillId, unitId!, skill.title, skill.description, skillIndex, skill.start ? 1 : 0, skill.id ?? null, now]);
      }
      writeSkillSettings(skillId, skill);
      kept.skills.add(skillId);
      if (skill.id) written.set(skill.id, skillId);
      skill.exercises.forEach((exercise, exerciseIndex) => {
        let exerciseId = exercise.id ? exercises.get(exercise.id) : undefined;
        if (exerciseId) {
          db.run("UPDATE exercises SET skill_id = ?, type = ?, prompt = ?, content_json = ?, explanation = ?, tier = ?, concepts_json = ?, position = ? WHERE id = ?", [
            skillId!, exercise.type, exercise.prompt, contentJson(exercise), exercise.explanation, tierOf(exercise), conceptsJson(exercise), exerciseIndex, exerciseId,
          ]);
        } else {
          exerciseId = crypto.randomUUID();
          db.run("INSERT INTO exercises (id, skill_id, type, prompt, content_json, explanation, tier, concepts_json, position, origin_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", [
            exerciseId, skillId!, exercise.type, exercise.prompt, contentJson(exercise), exercise.explanation, tierOf(exercise), conceptsJson(exercise), exerciseIndex, exercise.id ?? null, now,
          ]);
        }
        kept.exercises.add(exerciseId);
      });
    });
  });
  // Children first: a skill that moved to another unit must not go with its old unit.
  for (const id of exercises.values()) if (!kept.exercises.has(id)) db.run("DELETE FROM exercises WHERE id = ?", [id]);
  for (const id of skills.values()) if (!kept.skills.has(id)) db.run("DELETE FROM skills WHERE id = ?", [id]);
  for (const id of units.values()) if (!kept.units.has(id)) db.run("DELETE FROM units WHERE id = ?", [id]);
  writeLinks(subjectId, subject, written, now);
}

// Adds each chosen item as a new copy (remembering the file's ids, so a later
// version can update it) or updates your existing copy. Folders are always
// new: only the ones holding added items are created, under `folderId`.
// Top-level items go after whatever that folder already has, keeping file order.
export function importSubjects(userId: string, subjects: ExportSubject[], folders: ExportFolder[] = [], options: ImportOptions = {}): ImportResult {
  let skillCount = 0;
  let exerciseCount = 0;
  const ids: string[] = [];
  const updated: string[] = [];
  const destination = options.folderId ?? null;
  if (destination && !db.query("SELECT 1 FROM folders WHERE id = ? AND user_id = ? AND deleted_at IS NULL").get(destination, userId)) throw new Error("Folder not found");
  const plan = subjects.map((subject, index) => {
    const choice = options.choices?.[index] ?? "add";
    if (choice === "skip") return { subject, action: "skip" as const };
    const match = choice === "update" ? findMatch(userId, subject) : null;
    return match ? { subject, action: "update" as const, target: match.id } : { subject, action: "add" as const };
  });

  // Folders needed by added items, with their ancestors.
  const needed = new Set<number>();
  for (const step of plan) {
    if (step.action !== "add") continue;
    for (let at = step.subject.folder ?? null; at !== null && !needed.has(at); at = folders[at]!.parent) needed.add(at);
  }

  db.transaction(() => {
    const offset = nextPosition(userId, destination);
    const folderIds = new Map<number, string>();
    folders.forEach((folder, index) => {
      if (!needed.has(index)) return;
      const now = new Date().toISOString();
      const folderId = crypto.randomUUID();
      folderIds.set(index, folderId);
      db.run(
        "INSERT INTO folders (id, user_id, parent_id, name, color, position, archived_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [folderId, userId, folder.parent === null ? destination : folderIds.get(folder.parent)!, folder.name, folder.color, folder.parent === null ? offset + folder.position : folder.position, folder.archivedAt, now, now],
      );
    });
    plan.forEach((step, subjectIndex) => {
      const { subject } = step;
      if (step.action === "skip") return;
      skillCount += subject.units.reduce((sum, unit) => sum + unit.skills.length, 0);
      exerciseCount += subject.units.reduce((sum, unit) => sum + unit.skills.reduce((total, skill) => total + skill.exercises.length, 0), 0);
      if (step.action === "update") {
        updateFromFile(step.target, subject);
        ids.push(step.target);
        updated.push(step.target);
        return;
      }
      const now = new Date().toISOString();
      const subjectId = crypto.randomUUID();
      ids.push(subjectId);
      const folder = subject.folder ?? null;
      const at = subject.position ?? subjectIndex;
      db.run(
        "INSERT INTO subjects (id, user_id, type, level, notes, name, description, color, gradient_start, gradient_end, icon, unlock_in_order, unlock_tier, folder_id, position, archived_at, origin_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [subjectId, userId, subject.type ?? "subject", subject.level ?? null, subject.notes ?? "", subject.name, subject.description, subject.color, subject.gradientStart, subject.gradientEnd, subject.icon ?? null, subject.unlockInOrder ? 1 : 0, tierIndex(subject.unlockTier), folder === null ? destination : folderIds.get(folder)!, folder === null ? offset + at : at, subject.archivedAt ?? null, subject.id ?? null, now, now],
      );
      const history = subject.levelHistory?.length ? subject.levelHistory : subject.level != null ? [{ level: subject.level, at: now }] : [];
      for (const point of history) recordLevel(userId, subjectId, point.level, point.at);
      const written = new Map<string, string>();
      subject.units.forEach((unit, unitIndex) => {
        const unitId = crypto.randomUUID();
        db.run("INSERT INTO units (id, subject_id, title, description, position, origin_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)", [
          unitId, subjectId, unit.title, unit.description, unitIndex, unit.id ?? null, now,
        ]);
        unit.skills.forEach((skill, skillIndex) => {
          const skillId = crypto.randomUUID();
          db.run("INSERT INTO skills (id, unit_id, title, description, position, is_start, origin_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)", [
            skillId, unitId, skill.title, skill.description, skillIndex, skill.start ? 1 : 0, skill.id ?? null, now,
          ]);
          writeSkillSettings(skillId, skill);
          if (skill.id) written.set(skill.id, skillId);
          skill.exercises.forEach((exercise, exerciseIndex) => {
            const exerciseId = crypto.randomUUID();
            db.run(
              "INSERT INTO exercises (id, skill_id, type, prompt, content_json, explanation, tier, concepts_json, position, origin_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
              [exerciseId, skillId, exercise.type, exercise.prompt, contentJson(exercise), exercise.explanation, tierOf(exercise), conceptsJson(exercise), exerciseIndex, exercise.id ?? null, now],
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
              "INSERT INTO skill_progress (user_id, skill_id, tiers_cleared, expert_cleared_at, mastery, correct_attempts, total_attempts, last_practiced_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
              [userId, skillId, skill.progress.tiersCleared, skill.progress.expertClearedAt, skill.progress.mastery, Math.min(skill.progress.correctAttempts, skill.progress.totalAttempts), skill.progress.totalAttempts, skill.progress.lastPracticedAt],
            );
          }
        });
      });
      writeLinks(subjectId, subject, written, now);
    });
  })();
  if (ids.length === 0) throw new Error("Pick at least one item to import");
  return { subjects: ids.map((id) => getSubject(userId, id).subject), updated, skillCount, exerciseCount };
}
