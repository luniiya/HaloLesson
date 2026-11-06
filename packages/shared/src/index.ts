export const APP_VERSION = "0.0.1";
export const MIN_PASSWORD_LENGTH = 8;

const USERNAME_PATTERN = /^[a-zA-Z0-9_.\-]{3,32}$/;
export const USERNAME_HTML_PATTERN = "[a-zA-Z0-9_.\\-]+";

export function isValidUsername(username: string): boolean {
  return USERNAME_PATTERN.test(username);
}

// requireStrong=false only enforces non-empty, for servers that opted out via
// Settings.requireStrongPasswords. Shared so forms can check before submitting.
export function validatePassword(password: string, requireStrong = true): { valid: boolean; reason?: string } {
  if (!password) return { valid: false, reason: "Password is required" };
  if (!requireStrong) return { valid: true };
  if (password.length < MIN_PASSWORD_LENGTH) {
    return { valid: false, reason: "Password must be at least 8 characters" };
  }
  const classes = [/[A-Z]/, /[a-z]/, /[0-9]/, /[^A-Za-z0-9]/].filter((pattern) => pattern.test(password));
  if (classes.length < 2) {
    return {
      valid: false,
      reason: "Password must include at least 2 of: uppercase, lowercase, numbers, symbols",
    };
  }
  return { valid: true };
}

export interface User {
  id: string;
  username: string;
  email: string | null;
  createdAt: string;
  avatar: string | null;
  isAdmin: boolean;
  usernameChangedAt: string | null;
}

// Self-service username changes are limited to once per this many days.
export const USERNAME_CHANGE_COOLDOWN_DAYS = 30;
// Avatars are stored inline as data URLs; the client resizes before upload.
export const MAX_AVATAR_LENGTH = 400_000;

// `id` is a client-safe identifier, never the session token itself.
export interface SessionSummary {
  id: string;
  createdAt: string;
  lastSeenAt: string | null;
  device: "mobile" | "desktop";
  label: string;
  current: boolean;
}

export interface AdminUserSummary extends User {
  subjectCount: number;
  skillCount: number;
  lastSeenAt: string | null;
}

export interface Settings {
  signupEnabled: boolean;
  requireStrongPasswords: boolean;
  requireEmail: boolean;
}

export const SUBJECT_COLORS = ["green", "blue", "purple", "orange", "red"] as const;
export type SubjectColor = (typeof SUBJECT_COLORS)[number];

export interface Subject {
  id: string;
  name: string;
  description: string;
  color: SubjectColor;
  gradientStart: string;
  gradientEnd: string;
  createdAt: string;
  updatedAt: string;
  unitCount: number;
  skillCount: number;
}

export interface Unit {
  id: string;
  subjectId: string;
  title: string;
  description: string;
  position: number;
  createdAt: string;
}

export interface Skill {
  id: string;
  unitId: string;
  title: string;
  description: string;
  position: number;
  createdAt: string;
  stars: number;
  mastery: number;
  lastPracticedAt: string | null;
}

export interface SubjectDetail {
  subject: Subject;
  units: Array<Unit & { skills: Skill[] }>;
}

export type ExerciseType = "multiple_choice" | "free_text";

export interface Exercise {
  id: string;
  skillId: string;
  type: ExerciseType;
  prompt: string;
  content: Record<string, unknown>;
  explanation: string;
  position: number;
}

export interface PracticeExercise {
  id: string;
  type: ExerciseType;
  prompt: string;
  options: string[];
}

export interface PracticeSession {
  skillId: string;
  skillTitle: string;
  subjectId: string;
  subjectName: string;
  exercises: PracticeExercise[];
}

export interface AttemptResult {
  correct: boolean;
  correctAnswer: string;
  explanation: string;
  mastery: number;
  stars: number;
}

export interface ExportStats {
  subjectCount: number;
  unitCount: number;
  skillCount: number;
  exerciseCount: number;
}

export interface ExportExercise {
  type: ExerciseType;
  prompt: string;
  options?: string[];
  correctIndex?: number;
  answers?: string[];
  explanation: string;
}

export interface ExportSkill {
  title: string;
  description: string;
  exercises: ExportExercise[];
  progress?: { stars: number; mastery: number; correctAttempts: number; totalAttempts: number; lastPracticedAt: string | null };
}

export interface ExportSubject {
  name: string;
  description: string;
  color: SubjectColor;
  gradientStart: string;
  gradientEnd: string;
  units: Array<{ title: string; description: string; skills: ExportSkill[] }>;
}

// Backup / share format. Import also accepts the bare `{ subject, units }`
// shape the Create with AI prompt asks agents to return.
export interface ExportFile {
  format: "halolesson";
  formatVersion: 1;
  exportedAt: string;
  subjects: ExportSubject[];
}

export interface ImportResult {
  subjects: Subject[];
  skillCount: number;
  exerciseCount: number;
}
