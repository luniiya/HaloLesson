import type { AgentToken, User } from "@halolesson/shared";
import { toUser, type UserRow } from "../auth";
import { db } from "../db";

const TOKEN_PREFIX = "hla_";
const MAX_TOKENS_PER_USER = 50;
const LAST_USED_THROTTLE_MS = 60_000;
const RATE_WINDOW_MS = 60_000;
const RATE_LIMIT = 300;

interface TokenRow {
  id: string;
  user_id: string;
  hint: string;
  name: string;
  created_at: string;
  last_used_at: string | null;
}

export interface AgentAuth {
  user: User;
  tokenId: string;
}

export class RateLimitError extends Error {}

const usage = new Map<string, { windowStart: number; count: number }>();

function hashToken(secret: string): string {
  return new Bun.CryptoHasher("sha256").update(secret).digest("hex");
}

function toToken(row: TokenRow): AgentToken {
  return { id: row.id, name: row.name, hint: row.hint, createdAt: row.created_at, lastUsedAt: row.last_used_at };
}

export function createAgentToken(userId: string, name: string): { token: AgentToken; secret: string } {
  name = name.trim().slice(0, 60) || "Agent";
  const count = db.query<{ count: number }, [string]>("SELECT COUNT(*) AS count FROM agent_tokens WHERE user_id = ?").get(userId)!.count;
  if (count >= MAX_TOKENS_PER_USER) throw new Error(`You can have at most ${MAX_TOKENS_PER_USER} agent tokens. Revoke some in Sessions first`);
  const secret = TOKEN_PREFIX + Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString("base64url");
  const row: TokenRow = { id: crypto.randomUUID(), user_id: userId, hint: secret.slice(-4), name, created_at: new Date().toISOString(), last_used_at: null };
  db.run("INSERT INTO agent_tokens (id, user_id, token_hash, hint, name, created_at) VALUES (?, ?, ?, ?, ?, ?)", [
    row.id, userId, hashToken(secret), row.hint, row.name, row.created_at,
  ]);
  return { token: toToken(row), secret };
}

export function listAgentTokens(userId: string): AgentToken[] {
  return db
    .query<TokenRow, [string]>("SELECT * FROM agent_tokens WHERE user_id = ? ORDER BY created_at DESC")
    .all(userId)
    .map(toToken);
}

export function revokeAgentToken(userId: string, tokenId: string): void {
  const result = db.run("DELETE FROM agent_tokens WHERE id = ? AND user_id = ?", [tokenId, userId]);
  if (result.changes === 0) throw new Error("Token not found");
}

// Null when the header is missing or the token is unknown or revoked.
export function agentFromRequest(req: Request): AgentAuth | null {
  const header = req.headers.get("authorization") ?? "";
  const secret = header.match(/^Bearer\s+(\S+)$/i)?.[1];
  if (!secret?.startsWith(TOKEN_PREFIX)) return null;
  const row = db
    .query<UserRow & { token_id: string; token_last_used_at: string | null }, [string]>(
      `SELECT users.*, agent_tokens.id AS token_id, agent_tokens.last_used_at AS token_last_used_at
       FROM agent_tokens JOIN users ON users.id = agent_tokens.user_id WHERE agent_tokens.token_hash = ?`,
    )
    .get(hashToken(secret));
  if (!row) return null;

  const now = Date.now();
  const window = usage.get(row.token_id);
  if (!window || now - window.windowStart > RATE_WINDOW_MS) usage.set(row.token_id, { windowStart: now, count: 1 });
  else if (++window.count > RATE_LIMIT) throw new RateLimitError("Too many requests. Wait a minute and slow down");

  const lastUsed = row.token_last_used_at ? new Date(row.token_last_used_at).getTime() : 0;
  if (now - lastUsed > LAST_USED_THROTTLE_MS) {
    db.run("UPDATE agent_tokens SET last_used_at = ? WHERE id = ?", [new Date(now).toISOString(), row.token_id]);
  }
  return { user: toUser(row), tokenId: row.token_id };
}
