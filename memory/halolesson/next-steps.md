---
name: halolesson-next-steps
description: Where the project stands and what to do next — read this first after a /clear or new session
type: project
---

# haloLesson — Current State & Next Steps

*(as of 2026-11-05)*

## Status
- **Nothing built yet.** Repo contains only `AGENTS.md`, `CLAUDE.md`, and `memory/`.
- Research phase done: full Duolingo design-system notes + local example UIs live in `memory/duolingo-ui/` (see [[duolingo-example-uis]] — MUST use those as visual reference when building).

## Agreed plan
1. **Shell/base first**: Bun + React scaffold, routing, app layout skeleton, REAL auth (multi-user, decided 2026-11-05), lesson data-model stub. No polish.
2. **UI pass immediately after**: full Duolingo-style UI, done by the agent (user's explicit wish — "you're goated at UI"). Agent said it is ready for UI the moment the shell runs. UI must include a placeholder entry point for the future AI lesson-generation flow (bwl-style "copy prompt for agent" button, "more like dingcad" — details TBD, see [[halolesson-open-questions]]).
3. **After UI**: AI-assisted lesson generation endpoint/agent flow.

## On resume after /clear
- Read `memory/INDEX.md` → [[halolesson-vision]], this note, then the `memory/duolingo-ui/` notes.
- Confirm with the user, then start the shell scaffold (Bun + React).
- Before any screen work, open the reference assets in `memory/duolingo-ui/examples/`.
- Deferred questions to ask when relevant: [[halolesson-open-questions]].

Related: [[halolesson-vision]], [[user-preferences]]
