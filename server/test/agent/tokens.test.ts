import { describe, expect, test } from "bun:test";
import { agentFromRequest, createAgentToken, listAgentTokens, revokeAgentToken } from "../../src/agent/tokens";
import { db } from "../../src/db";
import { makeUser } from "../helpers";

const withToken = (secret: string) => new Request("http://test/api/agent/library", { headers: { Authorization: `Bearer ${secret}` } });

describe("agent tokens", () => {
  test("a created token authenticates as its user and is stored hashed", () => {
    const user = makeUser();
    const { token, secret } = createAgentToken(user.id, "Claude");
    expect(secret.startsWith("hla_")).toBe(true);
    expect(token.hint).toBe(secret.slice(-4));
    expect(agentFromRequest(withToken(secret))).toMatchObject({ user: { id: user.id }, tokenId: token.id });
    const stored = db.query<{ token_hash: string }, [string]>("SELECT token_hash FROM agent_tokens WHERE id = ?").get(token.id)!;
    expect(stored.token_hash).not.toContain(secret);
  });

  test("list shows the user's tokens with last use, never the secret", () => {
    const user = makeUser();
    const { secret } = createAgentToken(user.id, "  ");
    agentFromRequest(withToken(secret));
    const [listed] = listAgentTokens(user.id);
    expect(listed).toMatchObject({ name: "Agent" });
    expect(listed!.lastUsedAt).not.toBeNull();
    expect(JSON.stringify(listed)).not.toContain(secret);
    expect(listAgentTokens(makeUser().id)).toHaveLength(0);
  });

  test("revoked, unknown and malformed tokens are rejected", () => {
    const user = makeUser();
    const { token, secret } = createAgentToken(user.id, "x");
    expect(() => revokeAgentToken(makeUser().id, token.id)).toThrow("Token not found");
    revokeAgentToken(user.id, token.id);
    expect(agentFromRequest(withToken(secret))).toBeNull();
    expect(agentFromRequest(withToken("hla_nope"))).toBeNull();
    expect(agentFromRequest(withToken("not-a-token"))).toBeNull();
    expect(agentFromRequest(new Request("http://test/"))).toBeNull();
  });

  test("deleting the user deletes their tokens", () => {
    const user = makeUser();
    const { secret } = createAgentToken(user.id, "x");
    db.run("DELETE FROM users WHERE id = ?", [user.id]);
    expect(agentFromRequest(withToken(secret))).toBeNull();
  });
});
