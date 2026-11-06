import type { ShareLink, SharedSubject, Subject } from "@halolesson/shared";
import { db } from "./db";
import { buildExport, importSubjects } from "./dataExport";
import { getSubject } from "./subjects";

interface ShareRow {
  token: string;
  subject_id: string;
  created_at: string;
}

interface SharedRow extends ShareRow {
  user_id: string;
  username: string;
}

function toLink(row: ShareRow): ShareLink {
  return { token: row.token, createdAt: row.created_at };
}

export function getShareLink(userId: string, subjectId: string): ShareLink | null {
  getSubject(userId, subjectId); // throws unless the user owns it
  const row = db.query<ShareRow, [string]>("SELECT * FROM subject_shares WHERE subject_id = ?").get(subjectId);
  return row ? toLink(row) : null;
}

// Reuses the existing link so sharing twice never breaks one already sent.
export function createShareLink(userId: string, subjectId: string): ShareLink {
  const existing = getShareLink(userId, subjectId);
  if (existing) return existing;
  const token = Buffer.from(crypto.getRandomValues(new Uint8Array(18))).toString("base64url");
  db.run("INSERT INTO subject_shares (token, subject_id, created_at) VALUES (?, ?, ?)", [token, subjectId, new Date().toISOString()]);
  return getShareLink(userId, subjectId)!;
}

export function revokeShareLink(userId: string, subjectId: string): void {
  getSubject(userId, subjectId); // throws unless the user owns it
  db.run("DELETE FROM subject_shares WHERE subject_id = ?", [subjectId]);
}

function sharedRow(token: string): SharedRow {
  const row = db
    .query<SharedRow, [string]>(`
      SELECT subject_shares.*, subjects.user_id, users.username FROM subject_shares
      JOIN subjects ON subjects.id = subject_shares.subject_id
      JOIN users ON users.id = subjects.user_id
      WHERE subject_shares.token = ?
    `)
    .get(token);
  if (!row) throw new Error("Share link not found");
  return row;
}

export function getSharedSubject(viewerId: string, token: string): SharedSubject {
  const row = sharedRow(token);
  const { subject, units } = getSubject(row.user_id, row.subject_id);
  const exerciseCount = db.query<{ count: number }, [string]>("SELECT COUNT(*) AS count FROM exercises WHERE skill_id = ?");
  return {
    token,
    owner: row.username,
    isOwner: row.user_id === viewerId,
    subject: {
      name: subject.name,
      description: subject.description,
      color: subject.color,
      gradientStart: subject.gradientStart,
      gradientEnd: subject.gradientEnd,
      unitCount: subject.unitCount,
      skillCount: subject.skillCount,
    },
    units: units.map((unit) => ({
      title: unit.title,
      description: unit.description,
      skills: unit.skills.map((skill) => ({ title: skill.title, description: skill.description, exerciseCount: exerciseCount.get(skill.id)!.count })),
    })),
  };
}

// Copies the latest content (never the owner's progress) as a new subject.
export function copySharedSubject(viewerId: string, token: string): Subject {
  const row = sharedRow(token);
  const file = buildExport(row.user_id, row.subject_id);
  return importSubjects(viewerId, file.subjects).subjects[0]!;
}
