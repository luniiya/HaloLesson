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

## Build progress (2026-11-05)
- User added `TODO.md` as the durable checklist and expanded the active goal: complete the base, then the UI phase, with repeated desktop/mobile screenshot reviews and fixes until no material visual issues remain.
- Bun workspaces installed successfully. Server now has SQLite schema for auth, subjects, units, skills, exercises, attempts, and per-skill mastery; cookie auth; per-user subject list/create/detail APIs; production static SPA serving.
- `bun run check:server` passes. Real HTTP smoke test passed for registration, subject creation, cross-user isolation, session restore, logout, login, and persistence. API dev server runs on port 7246 through background task `bash-itgc4in1` (transient task id).
- Next: React auth/session flow, routed app shell, and working subject screens.

## Web shell progress (2026-11-05)
- React app now has `/login`, `/register`, `/`, and `/subjects/:subjectId`; cookie session restoration; protected routes; responsive desktop/mobile shell; subject creation; subject cards; and subject detail/empty states.
- Shared web API/auth utilities and reusable Button/Logo/AppLayout/SubjectCard/CreateSubjectForm components are in `web/src/`.
- `bun run check:web` and `bun run build` pass. Production Vite output is `web/dist/` and the Bun server serves it with SPA fallback.
- Next: full UI phase, including practice player and AI-generation placeholder, followed by repeated browser screenshot reviews at desktop and mobile sizes. Full browser-driven auth flow remains to be verified.

## UI and bwl progress (2026-11-05)
- Auth and dashboard received their first complete visual pass, with an original SVG mascot, rounded Nunito hierarchy, tactile buttons, refined empty states, and illustrated subject cards. Web check and production build pass.
- User explicitly requires **bwl, not Playwright**. Vite now runs on `0.0.0.0:7270`; bwl reaches it at `http://192.168.2.221:7270` (current machine) because the bwl server is `192.168.2.122`.
- bwl MCP session `fae75238-0897-4445-afc0-5f79f90f1d58`, dev-profile tab `d8b123e8-7922-4607-9561-1c58e3ab06f9` (both transient). bwl registration and subject creation work end to end. Desktop auth, empty dashboard, and populated dashboard screenshots were captured and visually reviewed in `data/screenshots/` (gitignored).
- Review note: bwl clicked the blue radio during subject creation but the API saved green. Confirm whether this is a hidden-radio bwl interaction issue or a real form bug during the next UI pass; do not claim color selection is verified yet.
- Next UI work: subject path, practice player, AI copy-prompt entry point, then more bwl visual passes and mobile viewport coverage.

## 3D book artwork (2026-11-05)
- Replaced the character with `BookArtwork.tsx`: CSS 3D open book, stationary thick green circular level base, stationary yellow halo, independent book rotation and floating motion, and reduced-motion support. No new dependency.
- User clarified with a Duolingo book-node image: the base is an empty green skill node, only the book rotates/floats, halo above it.
- Five bwl visual iterations caught and fixed oversized unlayered CSS, halo placement, top-down angle, and the pedestal incorrectly rotating with the book. Final multiple-frame bwl review matches the intended composition. Full `bun run check && bun run build` passes.
- Next: implement the orbital subjects screen from [[halolesson-subject-path-ui]], then the subject skill path.

## Orbital subjects screen (2026-11-05)
- Replaced the populated subject card grid with an orbital stage around the central `BookArtwork`; real subjects only, deterministic inline SVG symbols, tactile colored circles, responsive CSS, and View Transitions API navigation with reduced-motion fallback.
- Deleted the now-unused `SubjectCard.tsx`. `bun run check && bun run build` passes.
- bwl desktop screenshot `data/screenshots/bwl-orbital-desktop-v1.png` reviewed; subject click and animated reveal work. Subject screenshot is `bwl-orbital-subject-v1.png`.
- Current bwl tool list has no viewport emulation; `window.resizeTo` does not resize the browser and profile screens below 1024x600 are rejected. Do not switch to Playwright (explicit user instruction). True mobile screenshot coverage remains pending.
- Next: populated subject skill path, per-skill nodes, stars and gold mastery presentation.

## Skill path UI (2026-11-05)
- Added `SkillPath.tsx` and `SkillNode.tsx`: real API units render as colored unit banners and winding circular skill nodes. Nodes have tactile press/focus states, varied symbols, three-star progress, accessible mastery labels, and gold styling at three stars. Selecting a node opens a real skill/mastery preview.
- Added eight visual-review skills to the existing bwl test account's Physics subject directly in the local test DB; these are test data, not hardcoded product content.
- `bun run check && bun run build` passes. bwl screenshots `bwl-skill-path-v1.png` and `bwl-skill-preview-v1.png` reviewed; node interaction verified.
- Next: customizable subject gradients, practice player, and AI copy-prompt entry point.

## Subject gradients and color-control fix (2026-11-05)
- Added persisted `gradientStart`/`gradientEnd` hex fields with SQLite migration, shared types, server validation, creation-form native color inputs, and default gradient presets. Subject nodes and unit banners use the gradient; skill colors interpolate from start to end across the full path while gold mastery remains distinctive.
- Fixed the previously unresolved radio problem: the `sr-only` radio was not receiving bwl's click. The transparent input now covers the full visible color swatch. bwl confirmed checked value changes from green to purple and created a purple Design systems subject successfully.
- bwl screenshot `bwl-skill-gradient-v1.png` reviewed. Full `bun run check && bun run build` passes after the control fix.
- Next: real practice player and exercise/attempt endpoints.

## Practice player (2026-11-05)
- Added authenticated `GET /api/skills/:id/practice` and `POST /api/exercises/:id/attempt`, with ownership checks. Initial practice payloads omit correct answers and explanations; submission returns correction/explanation and updated mastery/stars, and attempts are stored transactionally.
- Added `/skills/:skillId/practice` with progress, multiple choice, free text, disabled/empty-answer states, correct/incorrect feedback, completion accuracy, and navigation back to the subject. Skill previews now have a working Practice now link.
- Added three Physics exercise fixtures only to the bwl test account. Full bwl run answered two correctly and one incorrectly; completion showed 67% / 2 of 3. DB confirmed 3 attempts, 2 correct, mastery 0.503842 and 1 star.
- Screenshots reviewed: `bwl-practice-question-v1.png`, `bwl-practice-correct-v1.png`, `bwl-practice-wrong-v1.png`, `bwl-practice-complete-v1.png`. `bun run check && bun run build` passes.
- Next: AI copy-prompt entry point, final responsive/accessibility review, and full browser auth flow.

## Agent prompt entry point (2026-11-05)
- Added global desktop/mobile Create with AI navigation and a native accessible `AgentPromptDialog`. It accepts a topic, generates a structured JSON authoring prompt, and copies it with clipboard plus fallback. Import/generation remains explicitly deferred.
- bwl reviewed `bwl-agent-dialog-v1.png`; topic editing changed the prompt and Copy agent prompt reached the Copied to clipboard state. `bun run check && bun run build` passes.
- Next: final responsive/accessibility review and full browser auth flow; mobile viewport remains limited by bwl's exposed tools.

## Browser auth verification (2026-11-05)
- Full bwl flow passed: original session restored after full navigation; logout reached login; registered fresh user `bwl_isolation_1105`; fresh account saw only the empty state and no original subjects; logged out and back into `bwl_ui_1105a`; Physics (8 skills) and Design systems returned.
- One bwl click sequence hit transient 500/stale-ref failures; fresh snapshot and current refs succeeded. No app defect was indicated by that tool failure.
- Base HTTP and browser auth/isolation flows are now both verified. Remaining: final accessibility/responsive review and mobile screenshots (current bwl API has no viewport emulation).

## Tabler icon standard (2026-11-05)
- User explicitly requested no ASCII arrows and Tabler icons everywhere interface icons are needed. Installed `@tabler/icons-react@3.50.0` in web.
- Replaced custom/ad-hoc navigation, subject/skill symbols, arrows, close, plus, sparkle, copy/check, empty-state, and star glyphs. Custom Logo SVG and BookArtwork remain brand illustrations.
- `bun run check && bun run build` passes; icon/glyph sweep has no remaining matches; bwl screenshot `bwl-tabler-home-v1.png` reviewed.
