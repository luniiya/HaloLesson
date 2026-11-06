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
  // Hex like "#7c5cff"; null means DEFAULT_ACCENT.
  accentColor: string | null;
  // Selected and active states (current page, chosen option); null means DEFAULT_SECONDARY.
  secondaryColor: string | null;
}

// The app's accent color drives buttons, highlights and the book artwork.
export const DEFAULT_ACCENT = "#7c5cff";
// Pink: pairs with the violet accent.
export const DEFAULT_SECONDARY = "#ec4f9a";
export const ACCENT_PRESETS = [
  { name: "Violet", color: "#7c5cff" },
  { name: "Ocean", color: "#1a9fe0" },
  { name: "Teal", color: "#12b5a5" },
  { name: "Pink", color: "#ec4f9a" },
  { name: "Coral", color: "#ff6b4a" },
  { name: "Green", color: "#58cc02" },
] as const;

export function isValidAccent(color: string): boolean {
  return /^#[0-9a-f]{6}$/i.test(color);
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

// Names of the icons a subject can wear; the web app maps each to a glyph.
export const SUBJECT_ICONS = [
  "atom", "world", "math", "flask", "code", "palette", "book", "music", "language", "heart", "rocket", "bulb", "dna",
  "microscope", "virology", "ecology", "astronomy", "mechanical", "electricity", "electronics", "civil", "architecture", "data",
  "databases", "computer-science", "ai", "neuroscience", "statistics", "geology", "medicine", "pharmacy", "economics", "law",
  "history", "philosophy", "sociology", "education", "literature", "literacy", "japanese", "finance",
  "investing", "saving", "accounting", "business", "marketing", "public-speaking", "project", "politics",
  "security", "networking", "web", "mobile", "satellites", "weather", "hydrology", "solar", "magnetism",
  "signals", "geometry", "industry", "repair", "marine", "insects", "pets", "horse", "forestry", "gardening", "flowers",
  "needle-thread", "knitting", "fashion", "cooking", "baking", "coffee", "nutrition", "woodworking", "painting", "drawing", "photography",
  "film", "podcast", "singing", "guitar", "piano", "production", "theatre", "music-theory",
  "dance", "fitness", "running", "cycling", "swimming", "yoga", "martial-arts", "fencing", "archery", "football",
  "tennis", "snow", "competition", "chess", "gaming", "cards", "puzzles", "tabletop", "driving", "travel",
  "aviation", "sailing", "navigation", "camping", "meditation", "3d", "graphic-design", "typography", "crafts", "sustainability",
  "home", "writing",
] as const;
export type SubjectIcon = (typeof SUBJECT_ICONS)[number];

export function isSubjectIcon(value: unknown): value is SubjectIcon {
  return typeof value === "string" && (SUBJECT_ICONS as readonly string[]).includes(value);
}

// A tracker sits in the library like a subject but holds no skills: it tracks
// something the user learns outside haloLesson, through a self-rated level and notes.
export const SUBJECT_TYPES = ["subject", "tracker"] as const;
export type SubjectType = (typeof SUBJECT_TYPES)[number];

export function isSubjectType(value: unknown): value is SubjectType {
  return typeof value === "string" && (SUBJECT_TYPES as readonly string[]).includes(value);
}

// The self-rated level, 0 to MAX_LEVEL. The label tells the user what each step means.
export const MAX_LEVEL = 10;
export const LEVEL_LABELS = [
  "Know nothing yet",
  "Total beginner",
  "Beginner",
  "Learning the basics",
  "Mid",
  "Okay",
  "Decent",
  "Confident",
  "Very good",
  "Brilliant",
  "The best",
] as const;

export function isLevel(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= MAX_LEVEL;
}

export const MAX_NOTES_LENGTH = 20_000;

// Trashed subjects and folders are deleted for good this many days later.
// Nobody (user or agent) can empty the trash earlier.
export const TRASH_RETENTION_DAYS = 30;

export interface Subject {
  id: string;
  type: SubjectType;
  name: string;
  description: string;
  color: SubjectColor;
  gradientStart: string;
  gradientEnd: string;
  // null means the app picks a default icon from the subject's id.
  icon: SubjectIcon | null;
  // The folder holding this subject; null means the top level of the library.
  folderId: string | null;
  position: number;
  archivedAt: string | null;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
  unitCount: number;
  skillCount: number;
  // Skills practiced to at least one star, out of skillCount.
  completedCount: number;
  // Self-rated, 0 to MAX_LEVEL; null until the user rates themselves.
  level: number | null;
  notes: string;
}

export interface Folder {
  id: string;
  parentId: string | null;
  name: string;
  // Hex like "#7c5cff".
  color: string;
  position: number;
  archivedAt: string | null;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

// Every folder and subject the user still has, in any state. Siblings (the
// folders and subjects sharing a parent) are ordered by `position` together.
export interface Library {
  folders: Folder[];
  subjects: Subject[];
}

export type ItemKind = "subject" | "folder";
export type ItemState = "active" | "archived" | "trashed";

// An item is trashed or archived when it, or any folder above it, is. Trash wins.
// Keyed by id (ids are unique across folders and subjects).
export function libraryStates(library: Library): Map<string, ItemState> {
  const folders = new Map(library.folders.map((folder) => [folder.id, folder]));
  const own = (item: { archivedAt: string | null; deletedAt: string | null }): ItemState => (item.deletedAt ? "trashed" : item.archivedAt ? "archived" : "active");
  const rank: Record<ItemState, number> = { active: 0, archived: 1, trashed: 2 };
  const stateOf = (item: { archivedAt: string | null; deletedAt: string | null }, parentId: string | null): ItemState => {
    let state = own(item);
    for (let depth = 0, id = parentId; id && depth < 64; depth += 1) {
      const folder = folders.get(id);
      if (!folder) break;
      if (rank[own(folder)] > rank[state]) state = own(folder);
      id = folder.parentId;
    }
    return state;
  };
  const states = new Map<string, ItemState>();
  for (const folder of library.folders) states.set(folder.id, stateOf(folder, folder.parentId));
  for (const subject of library.subjects) states.set(subject.id, stateOf(subject, subject.folderId));
  return states;
}

// When a trashed item is purged: its deletedAt plus TRASH_RETENTION_DAYS.
export function purgeDate(deletedAt: string): string {
  return new Date(new Date(deletedAt).getTime() + TRASH_RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();
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

export interface ShareLink {
  token: string;
  createdAt: string;
}

// What a share link shows: the subject's outline, no answers or progress.
export interface SharedSubject {
  token: string;
  owner: string;
  isOwner: boolean;
  subject: Pick<Subject, "name" | "description" | "color" | "gradientStart" | "gradientEnd" | "unitCount" | "skillCount">;
  units: Array<{ title: string; description: string; skills: Array<{ title: string; description: string; exerciseCount: number }> }>;
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

// One answer, kept in full backups for the statistics.
export interface ExportAttempt {
  at: string;
  correct: boolean;
  durationMs?: number | null;
  masteryAfter?: number | null;
}

export interface ExportExercise {
  // Stable across copies (format 2): importing a file again can update instead of duplicating.
  id?: string;
  type: ExerciseType;
  prompt: string;
  options?: string[];
  correctIndex?: number;
  answers?: string[];
  explanation: string;
  // Full backups only.
  attempts?: ExportAttempt[];
}

export interface ExportSkill {
  id?: string;
  title: string;
  description: string;
  exercises: ExportExercise[];
  progress?: { stars: number; mastery: number; correctAttempts: number; totalAttempts: number; lastPracticedAt: string | null };
}

export interface ExportUnit {
  id?: string;
  title: string;
  description: string;
  skills: ExportSkill[];
}

export interface ExportSubject {
  id?: string;
  // Missing in files made before trackers existed: "subject".
  type?: SubjectType;
  level?: number | null;
  notes?: string;
  // Every rating over time (null = cleared), full backups only.
  levelHistory?: Array<{ level: number | null; at: string }>;
  name: string;
  description: string;
  color: SubjectColor;
  gradientStart: string;
  gradientEnd: string;
  icon?: SubjectIcon | null;
  // Library placement, only in full backups (a shared subject lands at the
  // viewer's top level). `folder` indexes ExportFile.folders.
  folder?: number | null;
  position?: number;
  archivedAt?: string | null;
  units: ExportUnit[];
}

// A folder in a full backup. `parent` indexes ExportFile.folders and always
// points at an earlier entry, so parents are created before their children.
export interface ExportFolder {
  name: string;
  color: string;
  parent: number | null;
  position: number;
  archivedAt: string | null;
}

// Backup / share format. Import also accepts a bare `{ subject, units }`
// object for a single subject.
// A backup is a whole account and may carry personal data (progress, levels,
// notes, history); a share is one subject or tracker, content only.
export type ExportKind = "backup" | "share";
export const EXPORT_FORMAT_VERSION = 2;
export const HALO_FILE_EXTENSION = ".halo";

export interface ExportFile {
  format: "halolesson";
  formatVersion: 1 | 2;
  // Missing in format 1: backup when it has folders, else share.
  kind?: ExportKind;
  exportedAt: string;
  // Missing in files made before folders existed.
  folders?: ExportFolder[];
  subjects: ExportSubject[];
}

// What to do with one subject of a file: add it as a new copy, update the
// one you already have (same id lineage), or leave it out.
export type ImportChoice = "add" | "update" | "skip";

export interface ImportPreviewItem {
  // Position in the file; choices are given in this order.
  index: number;
  type: SubjectType;
  name: string;
  description: string;
  color: SubjectColor;
  gradientStart: string;
  icon: SubjectIcon | null;
  unitCount: number;
  skillCount: number;
  exerciseCount: number;
  // Folder names from the top, for backups.
  folderPath: string[];
  // Your existing copy of this item, if you have one.
  match: { id: string; name: string } | null;
}

export interface ImportPreview {
  kind: ExportKind;
  formatVersion: number;
  exportedAt: string | null;
  items: ImportPreviewItem[];
}

export interface ImportOptions {
  // One per item, in file order; missing entries mean "add".
  choices?: ImportChoice[];
  // Where new top-level items land (null: top of the library).
  folderId?: string | null;
}

export interface ImportResult {
  subjects: Subject[];
  // Ids of existing items that were updated in place (also listed in subjects).
  updated?: string[];
  skillCount: number;
  exerciseCount: number;
}

// An agent token lets an LLM agent read and edit one user's library over the
// agent API or MCP. Tokens never expire; users revoke them from Sessions.
export interface AgentToken {
  id: string;
  name: string;
  hint: string;
  createdAt: string;
  lastUsedAt: string | null;
}

// Returned once, when the token is created. The secret is never shown again.
export interface CreatedAgentToken {
  token: AgentToken;
  secret: string;
  prompt: string;
}

// Pushed over /api/events whenever a user's library changes.
export interface LibraryEvent {
  revision: number;
  subjectId: string | null;
}

// Statistics: one scope (everything, or one subject or tracker) over a range
// of days. Day keys are YYYY-MM-DD in the viewer's time zone.
export const STATS_RANGES = [7, 30, 90, 365] as const;

export interface StatsDay {
  date: string;
  answered: number;
  correct: number;
  timeMs: number;
  // Average mastery of the scope's skills at the end of the day, 0 to 1.
  mastery: number;
}

export interface StatsTotals {
  answered: number;
  correct: number;
  timeMs: number;
  practiceDays: number;
  // Streaks ignore the range: consecutive days with an answer, up to today.
  currentStreak: number;
  longestStreak: number;
  skillCount: number;
  skillsStarted: number;
  skillsMastered: number;
  ratings: number;
  firstActivityAt: string | null;
  lastActivityAt: string | null;
}

export interface StatsItem {
  id: string;
  type: SubjectType;
  name: string;
  color: SubjectColor;
  icon: SubjectIcon | null;
  level: number | null;
  // The rating in force when the range began (null if unrated then).
  levelAtStart: number | null;
  answered: number;
  correct: number;
  timeMs: number;
  skillCount: number;
  completedCount: number;
  mastery: number;
  lastActivityAt: string | null;
}

export interface StatsSkill {
  id: string;
  title: string;
  unitTitle: string;
  stars: number;
  mastery: number;
  answered: number;
  correct: number;
  timeMs: number;
  lastPracticedAt: string | null;
}

export interface Stats {
  subjectId: string | null;
  days: number | null;
  from: string;
  to: string;
  totals: StatsTotals;
  daily: StatsDay[];
  // Answers by weekday (0 = Monday) and hour of day, within the range.
  weekdays: number[];
  hours: number[];
  // Rating changes in the range, plus the rating in force at its start.
  levels: Array<{ subjectId: string; level: number | null; at: string }>;
  items: StatsItem[];
  skills: StatsSkill[];
}
