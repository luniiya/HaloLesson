export const APP_VERSION = "0.0.1";
export const MIN_PASSWORD_LENGTH = 8;

const USERNAME_PATTERN = /^[a-zA-Z0-9_.\-]{3,32}$/;
export const USERNAME_HTML_PATTERN = "[a-zA-Z0-9_.\\-]+";

export function isValidUsername(username: string): boolean {
  return USERNAME_PATTERN.test(username);
}

export function validatePassword(password: string): { valid: boolean; reason?: string } {
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
