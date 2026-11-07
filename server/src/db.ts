import { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

const dataDir = resolve(process.env.DATA_DIR ?? `${import.meta.dir}/../../data`);
mkdirSync(dataDir, { recursive: true });

export const db = new Database(`${dataDir}/halolesson.sqlite`);
db.exec("PRAGMA journal_mode = WAL;");
db.exec("PRAGMA foreign_keys = ON;");

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL COLLATE NOCASE,
    email TEXT UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

  CREATE TABLE IF NOT EXISTS subjects (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    color TEXT NOT NULL DEFAULT 'green',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_subjects_user ON subjects(user_id);

  CREATE TABLE IF NOT EXISTS units (
    id TEXT PRIMARY KEY,
    subject_id TEXT NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    position INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_units_subject ON units(subject_id, position);

  CREATE TABLE IF NOT EXISTS skills (
    id TEXT PRIMARY KEY,
    unit_id TEXT NOT NULL REFERENCES units(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    position INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_skills_unit ON skills(unit_id, position);

  CREATE TABLE IF NOT EXISTS exercises (
    id TEXT PRIMARY KEY,
    skill_id TEXT NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('multiple_choice', 'free_text')),
    prompt TEXT NOT NULL,
    content_json TEXT NOT NULL DEFAULT '{}',
    explanation TEXT NOT NULL DEFAULT '',
    position INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_exercises_skill ON exercises(skill_id, position);

  CREATE TABLE IF NOT EXISTS skill_progress (
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    skill_id TEXT NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
    stars INTEGER NOT NULL DEFAULT 0 CHECK (stars BETWEEN 0 AND 3),
    mastery REAL NOT NULL DEFAULT 0 CHECK (mastery BETWEEN 0 AND 1),
    correct_attempts INTEGER NOT NULL DEFAULT 0,
    total_attempts INTEGER NOT NULL DEFAULT 0,
    last_practiced_at TEXT,
    PRIMARY KEY (user_id, skill_id)
  );

  CREATE TABLE IF NOT EXISTS attempts (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    exercise_id TEXT NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
    answer_json TEXT NOT NULL DEFAULT 'null',
    is_correct INTEGER NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_attempts_user_exercise ON attempts(user_id, exercise_id, created_at);
`);

const subjectColumns = db.query<{ name: string }, []>("PRAGMA table_info(subjects)").all().map((column) => column.name);
if (!subjectColumns.includes("gradient_start")) db.exec("ALTER TABLE subjects ADD COLUMN gradient_start TEXT NOT NULL DEFAULT '#58cc02'");
if (!subjectColumns.includes("gradient_end")) db.exec("ALTER TABLE subjects ADD COLUMN gradient_end TEXT NOT NULL DEFAULT '#1cb0f6'");

db.exec(`
  CREATE TABLE IF NOT EXISTS settings (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    signup_enabled INTEGER NOT NULL DEFAULT 1,
    require_strong_passwords INTEGER NOT NULL DEFAULT 1,
    require_email INTEGER NOT NULL DEFAULT 0
  );
  INSERT OR IGNORE INTO settings (id) VALUES (1);
`);

function columnsOf(table: string): string[] {
  return db.query<{ name: string }, []>(`PRAGMA table_info(${table})`).all().map((column) => column.name);
}

const userColumns = columnsOf("users");
if (!userColumns.includes("avatar")) db.exec("ALTER TABLE users ADD COLUMN avatar TEXT");
if (!userColumns.includes("is_admin")) db.exec("ALTER TABLE users ADD COLUMN is_admin INTEGER NOT NULL DEFAULT 0");
if (!userColumns.includes("username_changed_at")) db.exec("ALTER TABLE users ADD COLUMN username_changed_at TEXT");
if (!userColumns.includes("accent_color")) db.exec("ALTER TABLE users ADD COLUMN accent_color TEXT");
if (!userColumns.includes("secondary_color")) db.exec("ALTER TABLE users ADD COLUMN secondary_color TEXT");

// Databases created before admin roles existed: the oldest account becomes admin,
// matching what a fresh install does for the first registered user.
const hasAdmin = db.query<{ id: string }, []>("SELECT id FROM users WHERE is_admin = 1 LIMIT 1").get();
if (!hasAdmin) db.exec("UPDATE users SET is_admin = 1 WHERE id = (SELECT id FROM users ORDER BY created_at LIMIT 1)");

// Sessions get a client-safe id (so the token never leaves the cookie) plus
// device info for the Sessions settings page.
const sessionColumns = columnsOf("sessions");
if (!sessionColumns.includes("id")) {
  db.exec("ALTER TABLE sessions ADD COLUMN id TEXT");
  db.exec("UPDATE sessions SET id = lower(hex(randomblob(16))) WHERE id IS NULL");
}
if (!sessionColumns.includes("user_agent")) db.exec("ALTER TABLE sessions ADD COLUMN user_agent TEXT");
if (!sessionColumns.includes("last_seen_at")) db.exec("ALTER TABLE sessions ADD COLUMN last_seen_at TEXT");
db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_sessions_id ON sessions(id)");

// Agent access: long-lived bearer tokens (only the SHA-256 is stored), a
// per-user revision so agents can detect concurrent edits, and replayable
// responses keyed by the agent's requestId so retries never apply twice.
if (!columnsOf("users").includes("library_revision")) db.exec("ALTER TABLE users ADD COLUMN library_revision INTEGER NOT NULL DEFAULT 0");
db.exec(`
  CREATE TABLE IF NOT EXISTS agent_tokens (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash TEXT UNIQUE NOT NULL,
    hint TEXT NOT NULL,
    name TEXT NOT NULL,
    created_at TEXT NOT NULL,
    last_used_at TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_agent_tokens_user ON agent_tokens(user_id);

  CREATE TABLE IF NOT EXISTS agent_requests (
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    request_id TEXT NOT NULL,
    body_hash TEXT NOT NULL,
    response_json TEXT NOT NULL,
    created_at TEXT NOT NULL,
    PRIMARY KEY (user_id, request_id)
  );

  CREATE TABLE IF NOT EXISTS agent_reports (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_id TEXT,
    message TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
`);

// Share links: one revocable token per subject. The link always shows the
// owner's latest version; viewers copy it into their own library.
db.exec(`
  CREATE TABLE IF NOT EXISTS subject_shares (
    token TEXT PRIMARY KEY,
    subject_id TEXT UNIQUE NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL
  );
`);

// Library organisation: nested folders, a shared position space for the
// folders and subjects under one parent, archive and trash flags. Trashed rows
// are purged TRASH_RETENTION_DAYS after deleted_at (see library.ts).
db.exec(`
  CREATE TABLE IF NOT EXISTS folders (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    parent_id TEXT REFERENCES folders(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    color TEXT NOT NULL DEFAULT '#7c5cff',
    position INTEGER NOT NULL DEFAULT 0,
    archived_at TEXT,
    deleted_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_folders_user ON folders(user_id, parent_id);
`);
const librarySubjectColumns = columnsOf("subjects");
if (!librarySubjectColumns.includes("folder_id")) db.exec("ALTER TABLE subjects ADD COLUMN folder_id TEXT REFERENCES folders(id) ON DELETE CASCADE");
if (!librarySubjectColumns.includes("position")) db.exec("ALTER TABLE subjects ADD COLUMN position INTEGER NOT NULL DEFAULT 0");
if (!librarySubjectColumns.includes("icon")) db.exec("ALTER TABLE subjects ADD COLUMN icon TEXT");
if (!librarySubjectColumns.includes("archived_at")) db.exec("ALTER TABLE subjects ADD COLUMN archived_at TEXT");
if (!librarySubjectColumns.includes("deleted_at")) db.exec("ALTER TABLE subjects ADD COLUMN deleted_at TEXT");
// Trackers (type "tracker") hold no units; level is self-rated 0-10, null until rated.
if (!librarySubjectColumns.includes("type")) db.exec("ALTER TABLE subjects ADD COLUMN type TEXT NOT NULL DEFAULT 'subject'");
if (!librarySubjectColumns.includes("level")) db.exec("ALTER TABLE subjects ADD COLUMN level INTEGER");
if (!librarySubjectColumns.includes("notes")) db.exec("ALTER TABLE subjects ADD COLUMN notes TEXT NOT NULL DEFAULT ''");
db.exec("CREATE INDEX IF NOT EXISTS idx_subjects_folder ON subjects(user_id, folder_id)");

// Statistics: every level rating is kept (null = rating cleared), and each
// attempt records how long the answer took and the skill's mastery after it,
// so progress over time can be charted.
const levelHistoryExists = db.query("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'level_history'").get();
db.exec(`
  CREATE TABLE IF NOT EXISTS level_history (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    subject_id TEXT NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
    level INTEGER,
    created_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_level_history_subject ON level_history(subject_id, created_at);
  CREATE INDEX IF NOT EXISTS idx_level_history_user ON level_history(user_id, created_at);
`);
// Ratings made before history existed become one point at the last edit.
if (!levelHistoryExists) {
  db.exec("INSERT INTO level_history (id, user_id, subject_id, level, created_at) SELECT lower(hex(randomblob(16))), user_id, id, level, updated_at FROM subjects WHERE level IS NOT NULL");
}
const attemptColumns = columnsOf("attempts");
if (!attemptColumns.includes("duration_ms")) db.exec("ALTER TABLE attempts ADD COLUMN duration_ms INTEGER");
if (!attemptColumns.includes("mastery_after")) db.exec("ALTER TABLE attempts ADD COLUMN mastery_after REAL");
db.exec("CREATE INDEX IF NOT EXISTS idx_attempts_user_time ON attempts(user_id, created_at)");

// Export format 2: content keeps the id it had in the file it came from, so a
// re-import of a newer version can update this copy instead of duplicating it.
for (const table of ["subjects", "units", "skills", "exercises"]) {
  if (!columnsOf(table).includes("origin_id")) db.exec(`ALTER TABLE ${table} ADD COLUMN origin_id TEXT`);
}
db.exec("CREATE INDEX IF NOT EXISTS idx_subjects_origin ON subjects(user_id, origin_id)");

// Skill graph: a subject's skills sit on a 2D map. Links have no direction
// (stored once, smaller id first). x and y are computed on the server by the
// layout in skillGraph.ts; the browser only draws them. With unlock_in_order
// on, a skill opens once it is a start skill or linked to a finished one.
db.exec(`
  CREATE TABLE IF NOT EXISTS skill_links (
    subject_id TEXT NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
    a TEXT NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
    b TEXT NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL,
    PRIMARY KEY (a, b),
    CHECK (a < b)
  );
  CREATE INDEX IF NOT EXISTS idx_skill_links_subject ON skill_links(subject_id);
  CREATE INDEX IF NOT EXISTS idx_skill_links_b ON skill_links(b);
`);
const graphSkillColumns = columnsOf("skills");
if (!graphSkillColumns.includes("x")) db.exec("ALTER TABLE skills ADD COLUMN x REAL");
if (!graphSkillColumns.includes("y")) db.exec("ALTER TABLE skills ADD COLUMN y REAL");
if (!graphSkillColumns.includes("is_start")) db.exec("ALTER TABLE skills ADD COLUMN is_start INTEGER NOT NULL DEFAULT 0");
// The map structure the stored positions were computed for (see ensureLayout).
if (!columnsOf("subjects").includes("layout_hash")) db.exec("ALTER TABLE subjects ADD COLUMN layout_hash TEXT");
// The start flag's place on the map, laid out with the skills.
if (!columnsOf("subjects").includes("start_x")) db.exec("ALTER TABLE subjects ADD COLUMN start_x REAL; ALTER TABLE subjects ADD COLUMN start_y REAL");
if (!columnsOf("subjects").includes("unlock_in_order")) db.exec("ALTER TABLE subjects ADD COLUMN unlock_in_order INTEGER NOT NULL DEFAULT 0");

// Skill tiers: every exercise sits in one tier's pool (0 easy .. 3 expert) and
// lists the concepts it tests. A skill clears its tiers in order; clearing
// Expert sets expert_cleared_at, which drives the gold/silver/copper medal.
// Skill settings decide the questions and hearts per session.
if (!columnsOf("exercises").includes("tier")) db.exec("ALTER TABLE exercises ADD COLUMN tier INTEGER NOT NULL DEFAULT 0");
if (!columnsOf("exercises").includes("concepts_json")) db.exec("ALTER TABLE exercises ADD COLUMN concepts_json TEXT NOT NULL DEFAULT '[]'");
if (!columnsOf("skills").includes("session_size")) db.exec("ALTER TABLE skills ADD COLUMN session_size INTEGER NOT NULL DEFAULT 10");
if (!columnsOf("skills").includes("hearts")) db.exec("ALTER TABLE skills ADD COLUMN hearts INTEGER NOT NULL DEFAULT 3");
if (!columnsOf("skill_progress").includes("tiers_cleared")) {
  db.exec("ALTER TABLE skill_progress ADD COLUMN tiers_cleared INTEGER NOT NULL DEFAULT 0");
  // Stars came before tiers: a starred skill counted as finished, so keep it open.
  db.exec("UPDATE skill_progress SET tiers_cleared = 1 WHERE stars > 0");
}
if (!columnsOf("skill_progress").includes("expert_cleared_at")) db.exec("ALTER TABLE skill_progress ADD COLUMN expert_cleared_at TEXT");

// Practice sessions live on the server so hearts and clears can't be skipped.
// queue_json is the exercise ids still to answer; a wrong one goes to the end.
// Every attempt records its session, tier and whether it was a retry, so the
// recommender can learn from failed sessions too.
db.exec(`
  CREATE TABLE IF NOT EXISTS practice_sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    skill_id TEXT NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
    tier INTEGER NOT NULL,
    hearts INTEGER NOT NULL,
    hearts_left INTEGER NOT NULL,
    queue_json TEXT NOT NULL,
    total INTEGER NOT NULL,
    done INTEGER NOT NULL DEFAULT 0,
    answered INTEGER NOT NULL DEFAULT 0,
    correct INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'active',
    started_at TEXT NOT NULL,
    ended_at TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_practice_sessions_user ON practice_sessions(user_id, skill_id, started_at);
`);
const tierAttemptColumns = columnsOf("attempts");
if (!tierAttemptColumns.includes("session_id")) db.exec("ALTER TABLE attempts ADD COLUMN session_id TEXT");
if (!tierAttemptColumns.includes("retry")) db.exec("ALTER TABLE attempts ADD COLUMN retry INTEGER NOT NULL DEFAULT 0");

// The tier (0 easy .. 3 expert) a skill must clear before the skills linked to it open.
if (!columnsOf("subjects").includes("unlock_tier")) db.exec("ALTER TABLE subjects ADD COLUMN unlock_tier INTEGER NOT NULL DEFAULT 0");
