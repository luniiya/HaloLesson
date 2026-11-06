---
name: agent-connect-design
description: Plan to let an agent edit haloLesson over HTTP with a scoped token, modeled on dingcad's "connect an agent" prompt
type: decision
---

*(as of 2026-11-06)* The user wants a dingcad-style "Connect an agent" flow (the user pasted dingcad's agent prompt as the reference). [[halolesson-open-questions]] explains what dingcad is.

What we copy from dingcad:
- One button mints a scoped, expiring, revocable token and builds a copyable prompt from the server (`GET /api/agent/prompt`).
- A short cheat-sheet spec (`/agent-api.txt`) plus a JSON schema of operations.
- `POST commits {expectedRevision, requestId (UUID), commands:[one op]}`.
  - `requestId` makes retries idempotent; a stale revision gets a 409, and the agent rereads and reconciles.
  - Operations replace a full record with an agent-chosen id: putSubject, putUnit, putSkill, putExercise, and delete*.
- The open subject page live-reloads (SSE) so the user watches the lesson being built.
- A complaint-jar endpoint.

What we skip: viewers and camera. Our server validates synchronously, so commit errors are the feedback.

Our own addition: a read-only endpoint for learner progress and mistakes, so the agent can generate targeted practice.

Proposed build order: tokens, then the commit API with the spec, then SSE live reload, then an MCP wrapper.

*(as of 2026-11-06)* I looked at bwl (`~/dev/bloom-web-link`) as the second reference.
- bwl is MCP-first. `src/mcp/server.ts` mounts `@modelcontextprotocol/sdk`'s `WebStandardStreamableHTTPServerTransport` directly inside Bun at `/mcp`.
- Tool definitions are shared between the HTTP and stdio servers in `mcp/lib/tool-contracts.mjs`.
- `src/web-ui/agent-prompt.ts` (`buildAgentPrompt`) builds the copy-paste prompt. It includes `claude mcp add` and `.mcp.json` snippets, and a "Remember this" section that tells the agent to save the setup to its CLAUDE.md or AGENTS.md.

Revised plan: one shared ops core, with two front doors.
- REST at `/api/agent/*`, dingcad-style.
- MCP at `/mcp` in the same Bun.serve, bwl-style.
- Commits work at skill granularity (a skill and its exercises together), not one op per request.
