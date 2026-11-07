import { isLevel, isTier, medalFor, skillLocks, TIERS, type Tier, isSubjectIcon, isSubjectType, MAX_LEVEL, MAX_NOTES_LENGTH, SUBJECT_COLORS, type Skill, type Subject, type SubjectColor, type SubjectDetail, type SubjectIcon, type SubjectType, type Unit } from "@halolesson/shared";
import { db } from "./db";
import { ensureLayout } from "./skillGraph";

interface SubjectRow {
  id: string;
  type: string;
  name: string;
  description: string;
  color: SubjectColor;
  gradient_start: string;
  gradient_end: string;
  icon: SubjectIcon | null;
  folder_id: string | null;
  position: number;
  archived_at: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
  unit_count: number;
  skill_count: number;
  completed_count: number;
  level: number | null;
  notes: string;
  unlock_in_order: number;
  unlock_tier: number;
}

function toSubject(row: SubjectRow): Subject {
  return {
    id: row.id,
    type: isSubjectType(row.type) ? row.type : "subject",
    name: row.name,
    description: row.description,
    color: row.color,
    gradientStart: row.gradient_start,
    gradientEnd: row.gradient_end,
    icon: isSubjectIcon(row.icon) ? row.icon : null,
    folderId: row.folder_id,
    position: row.position,
    archivedAt: row.archived_at,
    deletedAt: row.deleted_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    unitCount: row.unit_count,
    skillCount: row.skill_count,
    completedCount: row.completed_count,
    level: row.level,
    notes: row.notes,
    unlockInOrder: row.unlock_in_order === 1,
    unlockTier: TIERS[row.unlock_tier] ?? "easy",
  };
}

const subjectSelect = `
  SELECT subjects.*, COUNT(DISTINCT units.id) AS unit_count, COUNT(DISTINCT skills.id) AS skill_count,
    COUNT(DISTINCT CASE WHEN skill_progress.tiers_cleared > 0 THEN skills.id END) AS completed_count
  FROM subjects
  LEFT JOIN units ON units.subject_id = subjects.id
  LEFT JOIN skills ON skills.unit_id = units.id
  LEFT JOIN skill_progress ON skill_progress.skill_id = skills.id AND skill_progress.user_id = subjects.user_id
`;

// Subjects in library order. Trashed ones are left out unless asked for; they
// are only reachable through the library and trash views.
export function listSubjects(userId: string, includeTrashed = false): Subject[] {
  return db
    .query<SubjectRow, [string]>(
      `${subjectSelect} WHERE subjects.user_id = ? ${includeTrashed ? "" : "AND subjects.deleted_at IS NULL"} GROUP BY subjects.id ORDER BY subjects.position, subjects.created_at`,
    )
    .all(userId)
    .map(toSubject);
}

// The position that puts a new item last among the folders and subjects under `parentId`.
export function nextPosition(userId: string, parentId: string | null): number {
  return db
    .query<{ next: number }, [string, string | null, string, string | null]>(
      `SELECT COALESCE(MAX(position) + 1, 0) AS next FROM (
         SELECT position FROM subjects WHERE user_id = ? AND folder_id IS ?
         UNION ALL SELECT position FROM folders WHERE user_id = ? AND parent_id IS ?
       )`,
    )
    .get(userId, parentId, userId, parentId)!.next;
}

export interface SubjectFields {
  name: string;
  description: string;
  color: SubjectColor;
  gradientStart: string;
  gradientEnd: string;
  icon: SubjectIcon | null;
  level: number | null;
  notes: string;
  unlockInOrder: boolean;
  unlockTier: Tier;
}

export function checkLevel(level: unknown): number | null {
  if (level !== null && !isLevel(level)) throw new Error(`Level must be a whole number from 0 to ${MAX_LEVEL}`);
  return level;
}

// Throws a plain Error with a user-readable message; the HTTP layer turns it into a 400.
export function checkSubjectFields(fields: SubjectFields): SubjectFields {
  const name = fields.name.trim();
  const description = fields.description.trim();
  if (!name) throw new Error("Name is required");
  if (name.length > 80) throw new Error("Name must be 80 characters or fewer");
  if (description.length > 500) throw new Error("Description must be 500 characters or fewer");
  if (!SUBJECT_COLORS.includes(fields.color)) throw new Error("Choose a valid subject color");
  const hexColor = /^#[0-9a-f]{6}$/i;
  if (!hexColor.test(fields.gradientStart) || !hexColor.test(fields.gradientEnd)) throw new Error("Choose valid gradient colors");
  if (fields.icon !== null && !isSubjectIcon(fields.icon)) throw new Error("Choose a valid subject icon");
  checkLevel(fields.level);
  if (typeof fields.unlockInOrder !== "boolean") throw new Error("unlockInOrder must be true or false");
  if (!isTier(fields.unlockTier)) throw new Error(`unlockTier must be one of ${TIERS.join(", ")}`);
  if (fields.notes.length > MAX_NOTES_LENGTH) throw new Error(`Notes must be ${MAX_NOTES_LENGTH} characters or fewer`);
  return { ...fields, name, description };
}

export function createSubject(
  userId: string,
  name: string,
  description: string,
  color: SubjectColor,
  gradientStart: string,
  gradientEnd: string,
  options: { icon?: SubjectIcon | null; folderId?: string | null; type?: SubjectType; level?: number | null; notes?: string; unlockInOrder?: boolean; unlockTier?: Tier } = {},
): Subject {
  const fields = checkSubjectFields({ name, description, color, gradientStart, gradientEnd, icon: options.icon ?? null, level: options.level ?? null, notes: options.notes ?? "", unlockInOrder: options.unlockInOrder ?? false, unlockTier: options.unlockTier ?? "easy" });
  const type = options.type ?? "subject";
  if (!isSubjectType(type)) throw new Error("Choose a valid type: subject or tracker");
  const folderId = options.folderId ?? null;
  if (folderId && !db.query("SELECT 1 FROM folders WHERE id = ? AND user_id = ?").get(folderId, userId)) throw new Error("Folder not found");

  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  db.run(
    "INSERT INTO subjects (id, user_id, type, name, description, color, gradient_start, gradient_end, icon, level, notes, unlock_in_order, unlock_tier, folder_id, position, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    [id, userId, type, fields.name, fields.description, fields.color, fields.gradientStart, fields.gradientEnd, fields.icon, fields.level, fields.notes, fields.unlockInOrder ? 1 : 0, TIERS.indexOf(fields.unlockTier), folderId, nextPosition(userId, folderId), now, now],
  );
  if (fields.level !== null) recordLevel(userId, id, fields.level, now);
  return getSubject(userId, id).subject;
}

// Every rating change is kept for the level-over-time chart; null marks a cleared rating.
export function recordLevel(userId: string, subjectId: string, level: number | null, at = new Date().toISOString()) {
  db.run("INSERT INTO level_history (id, user_id, subject_id, level, created_at) VALUES (?, ?, ?, ?, ?)", [crypto.randomUUID(), userId, subjectId, level, at]);
}

// Partial edit: fields left out keep their value; `icon: null` goes back to the
// default icon, `level: null` clears the rating. The type never changes.
export function updateSubject(userId: string, subjectId: string, patch: Partial<SubjectFields>): Subject {
  const current = getSubject(userId, subjectId).subject;
  const fields = checkSubjectFields({
    name: patch.name ?? current.name,
    description: patch.description ?? current.description,
    color: patch.color ?? current.color,
    gradientStart: patch.gradientStart ?? current.gradientStart,
    gradientEnd: patch.gradientEnd ?? current.gradientEnd,
    icon: patch.icon === undefined ? current.icon : patch.icon,
    level: patch.level === undefined ? current.level : patch.level,
    notes: patch.notes ?? current.notes,
    unlockInOrder: patch.unlockInOrder ?? current.unlockInOrder,
    unlockTier: patch.unlockTier ?? current.unlockTier,
  });
  db.run("UPDATE subjects SET name = ?, description = ?, color = ?, gradient_start = ?, gradient_end = ?, icon = ?, level = ?, notes = ?, unlock_in_order = ?, unlock_tier = ?, updated_at = ? WHERE id = ?", [
    fields.name, fields.description, fields.color, fields.gradientStart, fields.gradientEnd, fields.icon, fields.level, fields.notes, fields.unlockInOrder ? 1 : 0, TIERS.indexOf(fields.unlockTier), new Date().toISOString(), subjectId,
  ]);
  if (fields.level !== current.level) recordLevel(userId, subjectId, fields.level);
  return getSubject(userId, subjectId).subject;
}

interface UnitRow {
  id: string;
  subject_id: string;
  title: string;
  description: string;
  position: number;
  created_at: string;
}

// Exercises per tier, from a JSON list of every exercise's tier.
function tierCounts(json: string): number[] {
  const counts = TIERS.map(() => 0);
  for (const tier of JSON.parse(json) as number[]) if (tier >= 0 && tier < counts.length) counts[tier]! += 1;
  return counts;
}

interface SkillRow {
  id: string;
  unit_id: string;
  title: string;
  description: string;
  position: number;
  created_at: string;
  tiers_cleared: number;
  expert_cleared_at: string | null;
  mastery: number;
  last_practiced_at: string | null;
  session_size: number;
  hearts: number;
  tier_counts: string;
  x: number | null;
  y: number | null;
  is_start: number;
}

export function getSubject(userId: string, subjectId: string): SubjectDetail {
  const row = db
    .query<SubjectRow, [string, string]>(`${subjectSelect} WHERE subjects.user_id = ? AND subjects.id = ? AND subjects.deleted_at IS NULL GROUP BY subjects.id`)
    .get(userId, subjectId);
  if (!row) throw new Error("Subject not found");
  ensureLayout(subjectId);

  const unitRows = db
    .query<UnitRow, [string]>("SELECT * FROM units WHERE subject_id = ? ORDER BY position, created_at")
    .all(subjectId);
  const units: Array<Unit & { skills: Skill[] }> = unitRows.map((unit) => ({
    id: unit.id,
    subjectId: unit.subject_id,
    title: unit.title,
    description: unit.description,
    position: unit.position,
    createdAt: unit.created_at,
    skills: db
      .query<SkillRow, [string, string]>(
        `SELECT skills.*, COALESCE(skill_progress.tiers_cleared, 0) AS tiers_cleared, skill_progress.expert_cleared_at,
         COALESCE(skill_progress.mastery, 0) AS mastery, skill_progress.last_practiced_at,
         (SELECT json_group_array(tier) FROM exercises WHERE exercises.skill_id = skills.id) AS tier_counts
         FROM skills LEFT JOIN skill_progress ON skill_progress.skill_id = skills.id AND skill_progress.user_id = ?
         WHERE skills.unit_id = ? ORDER BY skills.position, skills.created_at`,
      )
      .all(userId, unit.id)
      .map((skill) => ({
        id: skill.id,
        unitId: skill.unit_id,
        title: skill.title,
        description: skill.description,
        position: skill.position,
        createdAt: skill.created_at,
        tiersCleared: skill.tiers_cleared,
        medal: medalFor(skill.expert_cleared_at),
        mastery: skill.mastery,
        lastPracticedAt: skill.last_practiced_at,
        sessionSize: skill.session_size,
        hearts: skill.hearts,
        tierCounts: tierCounts(skill.tier_counts),
        x: skill.x,
        y: skill.y,
        start: skill.is_start === 1,
        locked: false,
      })),
  }));
  const links = db
    .query<{ a: string; b: string }, [string]>("SELECT a, b FROM skill_links WHERE subject_id = ? ORDER BY created_at, a, b")
    .all(subjectId)
    .map((link): [string, string] => [link.a, link.b]);
  const subject = toSubject(row);
  if (subject.unlockInOrder) {
    const locked = skillLocks(units.flatMap((unit) => unit.skills), links, subject.unlockTier);
    for (const skill of units.flatMap((unit) => unit.skills)) skill.locked = locked.has(skill.id);
  }
  return { subject, units, links };
}
