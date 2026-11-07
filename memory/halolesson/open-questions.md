---
name: halolesson-open-questions
description: Vision details the user deferred — ASK about these later when relevant
type: project
---

# haloLesson — Open Questions to Ask the User

*(as of 2026-11-04)* — user said "I won't detail all that now" and explicitly asked me to note these and ask later.

- ~~Auth details~~ → RESOLVED 2026-11-05: real multi-user auth in v1. Still open: which mechanism (email/password, OAuth, magic link) and which library.
- Data model: exact shape of a "lesson" — units/levels/exercises hierarchy? What exercise types beyond word-bank translation (Q&A, worked-example reconstruction, method-selection quizzes)?
- ~~How does a user author a lesson~~ → RESOLVED 2026-11-05: AI/agent-assisted generation (bwl-style copy-prompt endpoint, "more like dingcad"), built after UI.
- **What is "dingcad"?** (2026-11-05) — user referenced it as the model for the agent-generation flow; unknown to me, ask before building that part.
- Adaptive scheduling: how should recency/performance pick the next exercise? SM-2-like, simpler? (User asked what adaptive scheduling even is on 2026-11-05 — explain before designing.)
- ~~Scope of v1: single-user or multi-user~~ → RESOLVED 2026-11-05: multi-user with auth.
- Where does it deploy/run — local-only, homelab, public web?
- Naming/branding: is "haloLesson" final? Mascot? (Duolingo style thrives on a mascot.)

Related: [[halolesson-vision]]

- **"dingcad" resolved** *(as of 2026-11-06)*: it's github.com/yacineMTB/dingcad, a live-reload CAD tool that replaces OpenSCAD. You write `scene.js` (and can import assembly modules) using a small JS API documented in a one-page `API.md` cheat sheet. A raylib viewer polls the mtimes of the scene and its dependencies, then reloads. It's built for LLMs: "no docs, read the code", and an agent edits plain files while the human watches the result live. A shallow clone is at `~/ram/dingcad` (tmpfs, gone on reboot). See [[halolesson-next-steps]].

- **Deployment, name and mascot resolved** *(as of 2026-11-07)*: it runs wherever the user wants (self-hosted); a public hosted instance is undecided. "haloLesson" is the final name and the 3D book is the final mascot. The logo might still change.
- **License** *(as of 2026-11-07)*: undecided between AGPL-3.0 and Apache-2.0; the user asked for a recommendation (I recommended AGPL-3.0).
