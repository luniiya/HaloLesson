import { describe, expect, test } from "bun:test";
import { buildAgentPrompt } from "../../src/agent/prompt";

describe("agent prompt", () => {
  test("tells the agent to save the token privately and remember where", () => {
    const prompt = buildAgentPrompt("http://lan:7270", "hla_secret", "");
    expect(prompt).toContain("## Save the token");
    expect(prompt).toContain('claude mcp add --scope user --transport http halolesson http://lan:7270/mcp --header "Authorization: Bearer hla_secret"');
    expect(prompt).toContain("~/.config/halolesson/token");
    const remember = prompt.slice(prompt.indexOf("## Remember this"));
    expect(remember).toContain("where you saved the token");
    expect(remember).not.toContain("hla_secret");
  });
});
