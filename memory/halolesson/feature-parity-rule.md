---
name: feature-parity-rule
description: Every feature must ship in both the web UI and the agent interface (REST commits + MCP + prompt)
type: decision
---

*(as of 2026-11-06)* User rule: every feature added for either the agent or the user interface must exist in BOTH. Written into `CLAUDE.md` and `AGENTS.md` ("Feature parity" section).
- Put logic in one server module (e.g. `server/src/library.ts`), call it from the HTTP route and from `server/src/agent/ops.ts`; expose in `mcp.ts`; document in `prompt.ts`.
- Test both entry points. Exceptions only with the user's explicit say-so.
