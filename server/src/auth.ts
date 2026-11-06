import {
  isValidUsername,
  USERNAME_CHANGE_COOLDOWN_DAYS,
  validatePassword,
  type AdminUserSummary,
  type SessionSummary,
  type User,
} from "@halolesson/shared";
import { db } from "./db";
import { getSettings } from "./settings";

const SESSION_COOKIE = "halolesson_session";
const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000;
// last_seen_at is only bumped this often per session, so an active session
// doesn't turn every API call into a write.
const LAST_SEEN_THROTTLE_MS = 5 * 60 * 1000;
const MAX_LOGIN_ATTEMPTS = 5;
const LOGIN_LOCKOUT_MS = 15 * 60 * 1000;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_RULES = "Username must be 3-32 characters: letters, numbers, ., - and _ only";

export class ForbiddenError extends Error {}

interface UserRow {
  id: string;
  username: string;
  email: string | null;
  password_hash: string;
  created_at: string;
  avatar: string | null;
  is_admin: number;
  username_changed_at: string | null;
}

interface SessionRow {
  id: string;
  token: string;
  created_at: string;
  user_agent: string | null;
  last_seen_at: string | null;
}

function toUser(row: UserRow): User {
  return {
    id: row.id,
    username: row.username,
    email: row.email,
    createdAt: row.created_at,
    avatar: row.avatar,
    isAdmin: row.is_admin === 1,
    usernameChangedAt: row.username_changed_at,
  };
}

function userRow(userId: string): UserRow {
  const row = db.query<UserRow, [string]>("SELECT * FROM users WHERE id = ?").get(userId);
  if (!row) throw new Error("User not found");
  return row;
}

// Rough "Browser on OS" label and phone/desktop icon for the Sessions page,
// not an analytics-grade parser.
function parseUserAgent(userAgent: string | null): { device: "mobile" | "desktop"; label: string } {
  if (!userAgent) return { device: "desktop", label: "Unknown device" };
  let os = "Unknown OS";
  if (/Android/i.test(userAgent)) os = "Android";
  else if (/iPhone|iPad|iPod/i.test(userAgent)) os = "iOS";
  else if (/Windows/i.test(userAgent)) os = "Windows";
  else if (/Mac OS X|Macintosh/i.test(userAgent)) os = "macOS";
  else if (/Linux/i.test(userAgent)) os = "Linux";

  let browser = "Browser";
  if (/Edg\//i.test(userAgent)) browser = "Edge";
  else if (/OPR\//i.test(userAgent)) browser = "Opera";
  else if (/Firefox/i.test(userAgent)) browser = "Firefox";
  else if (/CriOS|Chrome/i.test(userAgent)) browser = "Chrome";
  else if (/Safari/i.test(userAgent)) browser = "Safari";
  else if (/curl|bun|node/i.test(userAgent)) browser = "Script";

  const device = /Android|iPhone|iPad|Mobile/i.test(userAgent) ? "mobile" : "desktop";
  return { device, label: `${browser} on ${os}` };
}

function parseCookies(header: string | null): Record<string, string> {
  const cookies: Record<string, string> = {};
  if (!header) return cookies;
  for (const part of header.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (!key) continue;
    try {
      cookies[key] = decodeURIComponent(rest.join("="));
    } catch {
      continue;
    }
  }
  return cookies;
}

function secureCookieFlag(): string {
  return process.env.COOKIE_SECURE === "1" ? "; Secure" : "";
}

export function sessionCookie(token: string): string {
  return `${SESSION_COOKIE}=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${SESSION_DURATION_MS / 1000}${secureCookieFlag()}`;
}

export function clearSessionCookie(): string {
  return `${SESSION_COOKIE}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0${secureCookieFlag()}`;
}

export function tokenFromRequest(req: Request): string | null {
  return parseCookies(req.headers.get("cookie"))[SESSION_COOKIE] ?? null;
}

export function userFromRequest(req: Request): User | null {
  const token = tokenFromRequest(req);
  if (!token) return null;
  const row = db
    .query<UserRow & { session_last_seen_at: string | null }, [string, string]>(
      `SELECT users.*, sessions.last_seen_at AS session_last_seen_at FROM sessions
       JOIN users ON users.id = sessions.user_id
       WHERE sessions.token = ? AND sessions.expires_at > ?`,
    )
    .get(token, new Date().toISOString());
  if (!row) return null;

  const lastSeen = row.session_last_seen_at ? new Date(row.session_last_seen_at).getTime() : 0;
  if (Date.now() - lastSeen > LAST_SEEN_THROTTLE_MS) {
    db.run("UPDATE sessions SET last_seen_at = ? WHERE token = ?", [new Date().toISOString(), token]);
  }
  return toUser(row);
}

function startSession(user: User, userAgent: string | null): { user: User; token: string } {
  const token = crypto.randomUUID();
  const now = new Date();
  db.run("DELETE FROM sessions WHERE user_id = ? AND expires_at <= ?", [user.id, now.toISOString()]);
  db.run(
    "INSERT INTO sessions (id, token, user_id, created_at, expires_at, user_agent, last_seen_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    [
      crypto.randomUUID(),
      token,
      user.id,
      now.toISOString(),
      new Date(now.getTime() + SESSION_DURATION_MS).toISOString(),
      userAgent?.slice(0, 500) ?? null,
      now.toISOString(),
    ],
  );
  return { user, token };
}

function normalizeEmail(email: string | null): string | null {
  return email?.trim().toLowerCase() || null;
}

function checkPassword(password: string) {
  const check = validatePassword(password, getSettings().requireStrongPasswords);
  if (!check.valid) throw new Error(check.reason);
}

function checkEmail(email: string | null, exceptUserId = "") {
  if (!email) {
    if (getSettings().requireEmail) throw new Error("Email is required");
    return;
  }
  if (!EMAIL_PATTERN.test(email)) throw new Error("Enter a valid email address");
  const taken = db
    .query<{ id: string }, [string, string]>("SELECT id FROM users WHERE email = ? COLLATE NOCASE AND id != ?")
    .get(email, exceptUserId);
  if (taken) throw new Error("An account with that email already exists");
}

function checkUsername(username: string, exceptUserId = "") {
  if (!isValidUsername(username)) throw new Error(USERNAME_RULES);
  const taken = db
    .query<{ id: string }, [string, string]>("SELECT id FROM users WHERE username = ? COLLATE NOCASE AND id != ?")
    .get(username, exceptUserId);
  if (taken) throw new Error("That username is already taken");
}

export function userCount(): number {
  return db.query<{ count: number }, []>("SELECT COUNT(*) AS count FROM users").get()!.count;
}

async function insertUser(username: string, password: string, email: string | null, isAdmin: boolean): Promise<User> {
  checkUsername(username);
  checkPassword(password);
  checkEmail(email);
  const row: UserRow = {
    id: crypto.randomUUID(),
    username,
    email,
    password_hash: await Bun.password.hash(password),
    created_at: new Date().toISOString(),
    avatar: null,
    is_admin: isAdmin ? 1 : 0,
    username_changed_at: null,
  };
  db.run("INSERT INTO users (id, username, email, password_hash, created_at, is_admin) VALUES (?, ?, ?, ?, ?, ?)", [
    row.id,
    row.username,
    row.email,
    row.password_hash,
    row.created_at,
    row.is_admin,
  ]);
  return toUser(row);
}

// The very first account is the setup account: always allowed, and admin.
export async function register(username: string, password: string, email: string | null, userAgent: string | null) {
  const isFirstUser = userCount() === 0;
  if (!isFirstUser && !getSettings().signupEnabled) throw new ForbiddenError("Sign ups are currently disabled");
  const user = await insertUser(username.trim(), password, normalizeEmail(email), isFirstUser);
  return startSession(user, userAgent);
}

interface LoginAttempt {
  failures: number;
  lockedUntil: number | null;
}
// In-memory and keyed by the attempted identifier (resets on restart): locking
// the account rather than the connection is what stops guesses against one username.
const loginAttempts = new Map<string, LoginAttempt>();

export async function login(identifier: string, password: string, userAgent: string | null) {
  identifier = identifier.trim().toLowerCase();
  const attempt = loginAttempts.get(identifier);
  if (attempt?.lockedUntil && Date.now() < attempt.lockedUntil) {
    const minutes = Math.ceil((attempt.lockedUntil - Date.now()) / 60_000);
    throw new Error(`Too many failed attempts. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`);
  }

  const row = db
    .query<UserRow, [string, string]>(
      "SELECT * FROM users WHERE username = ? COLLATE NOCASE OR email = ? COLLATE NOCASE",
    )
    .get(identifier, identifier);
  const valid = row ? await Bun.password.verify(password, row.password_hash) : false;
  if (!row || !valid) {
    const next = attempt ?? { failures: 0, lockedUntil: null };
    next.failures += 1;
    if (next.failures >= MAX_LOGIN_ATTEMPTS) next.lockedUntil = Date.now() + LOGIN_LOCKOUT_MS;
    loginAttempts.set(identifier, next);
    throw new Error("Invalid username/email or password");
  }

  loginAttempts.delete(identifier);
  return startSession(toUser(row), userAgent);
}

export function endSession(req: Request): void {
  const token = tokenFromRequest(req);
  if (token) db.run("DELETE FROM sessions WHERE token = ?", [token]);
}

// Username, email and password are sensitive: changing any of them requires the
// current password, so a session left open somewhere can't take over the account.
// A password change also signs out every other session.
export async function updateAccount(
  userId: string,
  currentToken: string | null,
  updates: { username?: string; email?: string | null; password?: string; avatar?: string | null; currentPassword?: string },
): Promise<User> {
  const row = userRow(userId);
  const sensitive = updates.username !== undefined || updates.email !== undefined || updates.password !== undefined;
  if (sensitive) {
    if (!updates.currentPassword) throw new Error("Current password is required");
    if (!(await Bun.password.verify(updates.currentPassword, row.password_hash))) {
      throw new Error("Current password is incorrect");
    }
  }

  const username = updates.username?.trim();
  if (username !== undefined && username !== row.username) {
    checkUsername(username, userId);
    // Signup doesn't set username_changed_at, so the first change is always allowed.
    if (row.username_changed_at) {
      const nextAllowed = new Date(row.username_changed_at).getTime() + USERNAME_CHANGE_COOLDOWN_DAYS * 86_400_000;
      if (Date.now() < nextAllowed) {
        throw new Error(
          `You can only change your username once every ${USERNAME_CHANGE_COOLDOWN_DAYS} days. Try again on ${new Date(nextAllowed).toISOString().slice(0, 10)}.`,
        );
      }
    }
  }
  const email = updates.email === undefined ? undefined : normalizeEmail(updates.email);
  if (email !== undefined) checkEmail(email, userId);
  if (updates.password !== undefined) checkPassword(updates.password);
  const passwordHash = updates.password === undefined ? null : await Bun.password.hash(updates.password);

  db.transaction(() => {
    if (username !== undefined && username !== row.username) {
      db.run("UPDATE users SET username = ?, username_changed_at = ? WHERE id = ?", [username, new Date().toISOString(), userId]);
    }
    if (email !== undefined) db.run("UPDATE users SET email = ? WHERE id = ?", [email, userId]);
    if (passwordHash) {
      db.run("UPDATE users SET password_hash = ? WHERE id = ?", [passwordHash, userId]);
      db.run("DELETE FROM sessions WHERE user_id = ? AND token != ?", [userId, currentToken ?? ""]);
    }
    if (updates.avatar !== undefined) db.run("UPDATE users SET avatar = ? WHERE id = ?", [updates.avatar, userId]);
  })();
  return toUser(userRow(userId));
}

function adminCount(): number {
  return db.query<{ count: number }, []>("SELECT COUNT(*) AS count FROM users WHERE is_admin = 1").get()!.count;
}

// Subjects, progress, attempts and sessions cascade through foreign keys.
export function deleteUser(userId: string): void {
  db.run("DELETE FROM users WHERE id = ?", [userId]);
}

export async function deleteOwnAccount(userId: string, currentPassword: string): Promise<void> {
  const row = userRow(userId);
  if (!currentPassword || !(await Bun.password.verify(currentPassword, row.password_hash))) {
    throw new Error("Current password is incorrect");
  }
  if (row.is_admin === 1 && adminCount() <= 1) throw new Error("You're the only admin. Make someone else an admin first.");
  deleteUser(userId);
}

// Returns the client-safe session id, never the token itself.
export function listSessions(userId: string, currentToken: string | null): SessionSummary[] {
  return db
    .query<SessionRow, [string, string]>(
      "SELECT * FROM sessions WHERE user_id = ? AND expires_at > ? ORDER BY COALESCE(last_seen_at, created_at) DESC",
    )
    .all(userId, new Date().toISOString())
    .map((row) => ({
      id: row.id,
      createdAt: row.created_at,
      lastSeenAt: row.last_seen_at,
      ...parseUserAgent(row.user_agent),
      current: row.token === currentToken,
    }));
}

export function revokeSession(userId: string, sessionId: string): void {
  db.run("DELETE FROM sessions WHERE id = ? AND user_id = ?", [sessionId, userId]);
}

export function revokeOtherSessions(userId: string, currentToken: string | null): void {
  db.run("DELETE FROM sessions WHERE user_id = ? AND token != ?", [userId, currentToken ?? ""]);
}

export function listUsers(): AdminUserSummary[] {
  const rows = db
    .query<UserRow & { subject_count: number; skill_count: number; last_seen_at: string | null }, []>(`
      SELECT users.*,
        (SELECT COUNT(*) FROM subjects WHERE subjects.user_id = users.id) AS subject_count,
        (SELECT COUNT(*) FROM skills JOIN units ON units.id = skills.unit_id
          JOIN subjects ON subjects.id = units.subject_id WHERE subjects.user_id = users.id) AS skill_count,
        (SELECT MAX(COALESCE(last_seen_at, created_at)) FROM sessions WHERE sessions.user_id = users.id) AS last_seen_at
      FROM users ORDER BY users.created_at
    `)
    .all();
  return rows.map((row) => ({
    ...toUser(row),
    subjectCount: row.subject_count,
    skillCount: row.skill_count,
    lastSeenAt: row.last_seen_at,
  }));
}

// Creates an account for someone else; doesn't sign the admin in as them.
export function adminCreateUser(username: string, password: string, email: string | null, isAdmin: boolean): Promise<User> {
  return insertUser(username.trim(), password, normalizeEmail(email), isAdmin);
}

// No current password needed: the caller is already gated by requireAdmin.
// Resetting someone's password signs them out everywhere.
export async function adminUpdateUser(adminId: string, userId: string, updates: { isAdmin?: boolean; password?: string }): Promise<User> {
  const row = userRow(userId);
  if (updates.isAdmin === false && row.is_admin === 1) {
    if (userId === adminId) throw new Error("You can't remove your own admin access");
    if (adminCount() <= 1) throw new Error("There must be at least one admin");
  }
  if (updates.password !== undefined) checkPassword(updates.password);
  const passwordHash = updates.password === undefined ? null : await Bun.password.hash(updates.password);
  db.transaction(() => {
    if (updates.isAdmin !== undefined) db.run("UPDATE users SET is_admin = ? WHERE id = ?", [updates.isAdmin ? 1 : 0, userId]);
    if (passwordHash) {
      db.run("UPDATE users SET password_hash = ? WHERE id = ?", [passwordHash, userId]);
      db.run("DELETE FROM sessions WHERE user_id = ?", [userId]);
    }
  })();
  return toUser(userRow(userId));
}
