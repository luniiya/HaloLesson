import { describe, expect, test } from "bun:test";
import { commit } from "../../src/agent/ops";
import { eventStream } from "../../src/events";
import { makeUser } from "../helpers";

describe("library events", () => {
  test("a commit pushes the new revision to the user's stream only", async () => {
    const user = makeUser();
    const other = makeUser();
    const controller = new AbortController();
    const reader = eventStream(new Request("http://test/api/events", { signal: controller.signal }), user.id).body!.getReader();
    const otherController = new AbortController();
    const otherReader = eventStream(new Request("http://test/api/events", { signal: otherController.signal }), other.id).body!.getReader();
    const decode = async (stream: typeof reader) => new TextDecoder().decode((await stream.read()).value);

    expect(await decode(reader)).toContain("event: ready");
    expect(await decode(otherReader)).toContain("event: ready");
    const saved = commit(user.id, { command: { op: "putSubject", subject: { name: "Live" } } });
    const chunk = await decode(reader);
    expect(chunk).toContain("event: library");
    expect(JSON.parse(chunk.split("data: ")[1]!)).toEqual({ revision: saved.revision, subjectId: saved.result.id });

    const pending = await Promise.race([otherReader.read().then(() => "got event"), Bun.sleep(20).then(() => "quiet")]);
    expect(pending).toBe("quiet");
    controller.abort();
    otherController.abort();
  });
});
