import { SUBJECT_COLORS, type Skill, type Subject, type SubjectColor, type SubjectDetail, type Unit } from "@halolesson/shared";
import { db } from "./db";

interface SubjectRow {
  id: string;
  name: string;
  description: string;
  color: SubjectColor;
  gradient_start: string;
  gradient_end: string;
  created_at: string;
  updated_at: string;
  unit_count: number;
  skill_count: number;
}

function toSubject(row: SubjectRow): Subject {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    color: row.color,
    gradientStart: row.gradient_start,
    gradientEnd: row.gradient_end,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    unitCount: row.unit_count,
    skillCount: row.skill_count,
  };
}

const subjectSelect = `
  SELECT subjects.*, COUNT(DISTINCT units.id) AS unit_count, COUNT(DISTINCT skills.id) AS skill_count
  FROM subjects
  LEFT JOIN units ON units.subject_id = subjects.id
  LEFT JOIN skills ON skills.unit_id = units.id
`;

export function listSubjects(userId: string): Subject[] {
  return db
    .query<SubjectRow, [string]>(`${subjectSelect} WHERE subjects.user_id = ? GROUP BY subjects.id ORDER BY subjects.updated_at DESC`)
    .all(userId)
    .map(toSubject);
}

export function createSubject(userId: string, name: string, description: string, color: SubjectColor, gradientStart: string, gradientEnd: string): Subject {
  name = name.trim();
  description = description.trim();
  if (!name) throw new Error("Subject name is required");
  if (name.length > 80) throw new Error("Subject name must be 80 characters or fewer");
  if (description.length > 500) throw new Error("Description must be 500 characters or fewer");
  if (!SUBJECT_COLORS.includes(color)) throw new Error("Choose a valid subject color");
  const hexColor = /^#[0-9a-f]{6}$/i;
  if (!hexColor.test(gradientStart) || !hexColor.test(gradientEnd)) throw new Error("Choose valid gradient colors");

  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  db.run("INSERT INTO subjects (id, user_id, name, description, color, gradient_start, gradient_end, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)", [
    id,
    userId,
    name,
    description,
    color,
    gradientStart,
    gradientEnd,
    now,
    now,
  ]);
  return getSubject(userId, id).subject;
}

interface UnitRow {
  id: string;
  subject_id: string;
  title: string;
  description: string;
  position: number;
  created_at: string;
}

interface SkillRow {
  id: string;
  unit_id: string;
  title: string;
  description: string;
  position: number;
  created_at: string;
  stars: number;
  mastery: number;
  last_practiced_at: string | null;
}

export function getSubject(userId: string, subjectId: string): SubjectDetail {
  const row = db
    .query<SubjectRow, [string, string]>(`${subjectSelect} WHERE subjects.user_id = ? AND subjects.id = ? GROUP BY subjects.id`)
    .get(userId, subjectId);
  if (!row) throw new Error("Subject not found");

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
        `SELECT skills.*, COALESCE(skill_progress.stars, 0) AS stars,
         COALESCE(skill_progress.mastery, 0) AS mastery, skill_progress.last_practiced_at
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
        stars: skill.stars,
        mastery: skill.mastery,
        lastPracticedAt: skill.last_practiced_at,
      })),
  }));
  return { subject: toSubject(row), units };
}
