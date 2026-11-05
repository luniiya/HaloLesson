import { isValidUsername, validatePassword, type User } from "@halolesson/shared";
import { db } from "./db";

const SESSION_COOKIE = "halolesson_session";
const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000;
const MAX_LOGIN_ATTEMPTS = 5;
const LOGIN_LOCKOUT_MS = 15 * 60 * 1000;

interface UserRow {
  id: string;
  username: string;
  email: string | null;
  password_hash: string;
  created_at: string;
}

function toUser(row: UserRow): User {
  return {
    id: row.id,
    username: row.username,
    email: row.email,
    createdAt: row.created_at,
  };
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

function tokenFromRequest(req: Request): string | null {
  return parseCookies(req.headers.get("cookie"))[SESSION_COOKIE] ?? null;
}

export function userFromRequest(req: Request): User | null {
  const token = tokenFromRequest(req);
  if (!token) return null;
  const row = db
    .query<UserRow, [string, string]>(
      `SELECT users.* FROM sessions
       JOIN users ON users.id = sessions.user_id
       WHERE sessions.token = ? AND sessions.expires_at > ?`,
    )
    .get(token, new Date().toISOString());
  return row ? toUser(row) : null;
}

function startSession(user: User): { user: User; token: string } {
  const token = crypto.randomUUID();
  const now = new Date();
  db.run("INSERT INTO sessions (token, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)", [
    token,
    user.id,
    now.toISOString(),
    new Date(now.getTime() + SESSION_DURATION_MS).toISOString(),
  ]);
  return { user, token };
}

export async function register(username: string, password: string, email: string | null) {
  username = username.trim();
  email = email?.trim().toLowerCase() || null;
  if (!isValidUsername(username)) {
    throw new Error("Username must be 3-32 characters: letters, numbers, ., - and _ only");
  }
  const passwordCheck = validatePassword(password);
  if (!passwordCheck.valid) throw new Error(passwordCheck.reason);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Enter a valid email address");

  const existing = db
    .query<{ id: string }, [string, string | null, string | null]>(
      "SELECT id FROM users WHERE username = ? COLLATE NOCASE OR (? IS NOT NULL AND email = ? COLLATE NOCASE)",
    )
    .get(username, email, email);
  if (existing) throw new Error("An account with that username or email already exists");

  const row: UserRow = {
    id: crypto.randomUUID(),
    username,
    email,
    password_hash: await Bun.password.hash(password),
    created_at: new Date().toISOString(),
  };
  db.run("INSERT INTO users (id, username, email, password_hash, created_at) VALUES (?, ?, ?, ?, ?)", [
    row.id,
    row.username,
    row.email,
    row.password_hash,
    row.created_at,
  ]);
  return startSession(toUser(row));
}

interface LoginAttempt {
  failures: number;
  lockedUntil: number | null;
}
const loginAttempts = new Map<string, LoginAttempt>();

export async function login(identifier: string, password: string) {
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
  return startSession(toUser(row));
}

export function endSession(req: Request): void {
  const token = tokenFromRequest(req);
  if (token) db.run("DELETE FROM sessions WHERE token = ?", [token]);
}
