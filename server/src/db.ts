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
