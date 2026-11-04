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
