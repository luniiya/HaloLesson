// Linked Anki accounts. Only the sync host key is kept (never the password),
// encrypted at rest with AES-256-GCM under a key file in DATA_DIR. The
// downloaded collection ("mirror") lives at DATA_DIR/anki/<userId>.anki2.
import { chmodSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { join, resolve } from "node:path";
import { db } from "../db";

const dataDir = resolve(process.env.DATA_DIR ?? `${import.meta.dir}/../../../data`);
export const ankiDir = join(dataDir, "anki");

db.run(`
  CREATE TABLE IF NOT EXISTS anki_accounts (
    user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    username TEXT NOT NULL,
    endpoint TEXT NOT NULL,
    host_key_enc TEXT NOT NULL,
    linked_at TEXT NOT NULL,
    -- The server's collection mod time when the mirror was downloaded.
    server_mod INTEGER,
    downloaded_at TEXT,
    synced_at TEXT,
    status TEXT NOT NULL DEFAULT 'idle',
    error TEXT
  )
`);

export interface AccountRow {
  user_id: string;
  username: string;
  endpoint: string;
  host_key_enc: string;
  linked_at: string;
  server_mod: number | null;
  downloaded_at: string | null;
  synced_at: string | null;
  status: string;
  error: string | null;
}

function secretKey(): Buffer {
  mkdirSync(ankiDir, { recursive: true, mode: 0o700 });
  const path = join(ankiDir, "secret.key");
  if (!existsSync(path)) {
    writeFileSync(path, randomBytes(32), { mode: 0o600, flag: "wx" });
  }
  chmodSync(path, 0o600);
  const key = readFileSync(path);
  if (key.length !== 32) throw new Error("The Anki key file is damaged");
  return key;
}

export function encrypt(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", secretKey(), iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64"), cipher.getAuthTag().toString("base64"), data.toString("base64")].join(".");
}

export function decrypt(sealed: string): string {
  const [version, iv, tag, data] = sealed.split(".");
  if (version !== "v1" || !iv || !tag || !data) throw new Error("Stored Anki key is unreadable. Link your account again");
  const decipher = createDecipheriv("aes-256-gcm", secretKey(), Buffer.from(iv, "base64"));
  decipher.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(data, "base64")), decipher.final()]).toString("utf8");
}

export function getAccount(userId: string): AccountRow | null {
  return db.query<AccountRow, [string]>("SELECT * FROM anki_accounts WHERE user_id = ?").get(userId);
}

export function saveAccount(userId: string, username: string, endpoint: string, hostKey: string) {
  db.run(
    `INSERT INTO anki_accounts (user_id, username, endpoint, host_key_enc, linked_at, status) VALUES (?, ?, ?, ?, ?, 'idle')
     ON CONFLICT(user_id) DO UPDATE SET username = excluded.username, endpoint = excluded.endpoint, host_key_enc = excluded.host_key_enc,
       linked_at = excluded.linked_at, server_mod = NULL, downloaded_at = NULL, synced_at = NULL, status = 'idle', error = NULL`,
    [userId, username, endpoint, encrypt(hostKey), new Date().toISOString()],
  );
}

export function updateAccount(userId: string, fields: Partial<Omit<AccountRow, "user_id" | "host_key_enc">>) {
  const keys = Object.keys(fields) as Array<keyof typeof fields>;
  if (!keys.length) return;
  db.run(`UPDATE anki_accounts SET ${keys.map((key) => `${key} = ?`).join(", ")} WHERE user_id = ?`, [...keys.map((key) => fields[key] ?? null), userId]);
}

export function hostKeyFor(row: AccountRow): string {
  return decrypt(row.host_key_enc);
}

export function mirrorPath(userId: string) {
  if (!/^[0-9a-f-]{8,64}$/i.test(userId)) throw new Error("Invalid user id");
  return join(ankiDir, `${userId}.anki2`);
}

// Removes the key and every cached file for the user.
export function deleteAccount(userId: string) {
  db.run("DELETE FROM anki_accounts WHERE user_id = ?", [userId]);
  removeMirrorFiles(userId);
}

export function removeMirrorFiles(userId: string) {
  const base = mirrorPath(userId);
  for (const suffix of ["", "-wal", "-shm", "-journal", ".tmp"]) rmSync(`${base}${suffix}`, { force: true });
}

// Mirrors whose account is gone (the user unlinked or was deleted).
export function sweepOrphans() {
  if (!existsSync(ankiDir)) return;
  const linked = new Set(db.query<{ user_id: string }, []>("SELECT user_id FROM anki_accounts").all().map((row) => row.user_id));
  for (const name of readdirSync(ankiDir)) {
    const match = /^([0-9a-f-]+)\.anki2/i.exec(name);
    if (match && !linked.has(match[1]!)) rmSync(join(ankiDir, name), { force: true });
  }
}
