import { describe, expect, test } from "bun:test";
import { handleMcp } from "../../src/agent/mcp";
import { readLibrary } from "../../src/agent/ops";
import { createAgentToken } from "../../src/agent/tokens";
import { makeUser } from "../helpers";

function rpc(secret: string | null, method: string, params: Record<string, unknown> = {}) {
  const headers: Record<string, string> = { "Content-Type": "application/json", Accept: "application/json, text/event-stream" };
  if (secret) headers.Authorization = `Bearer ${secret}`;
  return handleMcp(new Request("http://test/mcp", { method: "POST", headers, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) }));
}

async function callTool(secret: string, name: string, args: Record<string, unknown> = {}) {
  const response = await rpc(secret, "tools/call", { name, arguments: args });
  const { result } = (await response.json()) as { result: { isError?: boolean; content: Array<{ text: string }> } };
  return { isError: result.isError ?? false, data: JSON.parse(result.content[0]!.text) as Record<string, any> };
}

describe("MCP endpoint", () => {
  test("rejects requests without a valid token", async () => {
    expect((await rpc(null, "tools/list")).status).toBe(401);
    expect((await rpc("hla_bogus", "tools/list")).status).toBe(401);
  });

  test("initialize and list tools", async () => {
    const { secret } = createAgentToken(makeUser().id, "mcp");
    const init = await rpc(secret, "initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "test", version: "1" } });
    expect(((await init.json()) as any).result.serverInfo.name).toBe("halolesson");
    const list = (await (await rpc(secret, "tools/list")).json()) as { result: { tools: Array<{ name: string }> } };
    expect(list.result.tools.map((tool) => tool.name)).toContain("halo_put_skill");
  });

  test("tools build a subject end to end", async () => {
    const user = makeUser();
    const { secret } = createAgentToken(user.id, "mcp");
    const subject = await callTool(secret, "halo_put_subject", { subject: { name: "Chem" } });
    const unit = await callTool(secret, "halo_put_unit", { unit: { subjectId: subject.data.result.id, title: "Moles" } });
    const skill = await callTool(secret, "halo_put_skill", {
      skill: { unitId: unit.data.result.id, title: "Molar mass", exercises: [{ type: "free_text", prompt: "H2O?", answers: ["18", "18 g/mol"] }] },
    });
    expect(skill.isError).toBe(false);
    const read = await callTool(secret, "halo_get_subject", { subjectId: subject.data.result.id });
    expect(read.data.units[0].skills[0].exercises[0].answers).toEqual(["18", "18 g/mol"]);
    expect(readLibrary(user.id).subjects).toHaveLength(1);
  });

  test("errors come back as tool errors with a code", async () => {
    const { secret } = createAgentToken(makeUser().id, "mcp");
    const missing = await callTool(secret, "halo_get_subject", { subjectId: "nope" });
    expect(missing).toMatchObject({ isError: true, data: { code: "NOT_FOUND" } });
    const badKind = await callTool(secret, "halo_delete", { kind: "planet", id: "x" });
    expect(badKind).toMatchObject({ isError: true, data: { code: "UNKNOWN_OP" } });
  });

  test("library tools organise, trash and restore, but never delete for good", async () => {
    const { secret } = createAgentToken(makeUser().id, "mcp");
    const names = ((await (await rpc(secret, "tools/list")).json()) as { result: { tools: Array<{ name: string }> } }).result.tools.map((tool) => tool.name);
    expect(names).toEqual(expect.arrayContaining(["halo_put_folder", "halo_move", "halo_archive", "halo_trash", "halo_restore"]));
    const folder = (await callTool(secret, "halo_put_folder", { folder: { name: "Languages" } })).data.result.id as string;
    const subject = (await callTool(secret, "halo_put_subject", { subject: { name: "French", folderId: folder, icon: "language" } })).data.result.id as string;
    await callTool(secret, "halo_trash", { kind: "subject", id: subject });
    const library = (await callTool(secret, "halo_get_library")).data as any;
    expect(library.subjects[0]).toMatchObject({ id: subject, folderId: folder, icon: "language", state: "trashed" });
    await callTool(secret, "halo_restore", { kind: "subject", id: subject });
    expect(((await callTool(secret, "halo_get_library")).data as any).subjects[0].state).toBe("active");
    expect((await callTool(secret, "halo_archive", { kind: "planet", id: subject })).isError).toBe(true);
  });
});
