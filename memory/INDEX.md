# Memory Index

## halolesson
- [haloLesson vision](halolesson/vision.md) — Duolingo-style hot-recall engine; user-created lessons; React+Bun; shell first, then UI
- [haloLesson next steps](halolesson/next-steps.md) — READ FIRST after /clear: latest status at the bottom (2026-11-07: stats, .halolesson export, skill map built, uncommitted)
- [haloLesson open questions](halolesson/open-questions.md) — deferred vision details to ask the user later
- [recoral reference](halolesson/recoral-reference.md) — ../recoral = stack+auth donor: Bun monorepo, bun:sqlite, hand-rolled cookie auth, React 19/Vite/Tailwind 4
- [Development environment](halolesson/development-environment.md) — port 7270 is open for bwl UI testing; API uses 7246
- [Branding](halolesson/branding.md) — prefer a rotating 3D open book on a display plate with a yellow halo, not a character mascot
- [Accent color setting](halolesson/accent-color-setting.md) — per-user --accent var, default violet #7c5cff, Settings > Appearance
- [Subject path UI](halolesson/subject-path-ui.md) — orbital subjects, circular skill nodes, custom subject gradients, gold perfected levels
- [Feature parity rule](halolesson/feature-parity-rule.md) — every feature must exist in both the web UI and the agent interface
- [Library organisation](halolesson/library-organisation.md) — Edit mode, nested folders, archive, 30-day trash, subject icons
- [Data portability](halolesson/data-portability.md) — later: export/import plus sharing individual skills and whole subjects
- [Account system port](halolesson/account-system-port.md) — 2026-11-06: port recoral setup/account/sessions/admin/settings/import-export

## anki
- [User Anki server](anki/user-anki-server.md) — anki.luniiya.me holds the user's REAL collection; non-destructive calls only; default URL AnkiWeb
- [Anki link feature](anki/anki-link-feature.md) — Settings link, Flashcards tab under Learn (only when linked), merged labelled stats, never store password
- [Anki sync protocol](anki/anki-sync-protocol.md) — v11 sync over zstd JSON, schema 18, normal sync steps, never full upload
- [Anki scheduler port](anki/anki-scheduler-port.md) — scheduler.ts matches Python Anki exactly (SM-2 + FSRS, fuzz off); own fuzz RNG

## user
- [User preferences](user/preferences.md) — token-conscious, casual; NO unrequested bwl visual checks

## duolingo-ui
- [Duolingo color palette](duolingo-ui/color-palette.md) — full token set: owl green family, streak orange, eel blue, surfaces, ink
- [Duolingo typography](duolingo-ui/typography.md) — Feather Bold + Mona Sans hierarchy, sizes, weights
- [Duolingo component recipes](duolingo-ui/components.md) — 3D tactile buttons, cards, inputs, progress bars, skill nodes
- [Duolingo spacing & motion](duolingo-ui/spacing-motion.md) — 4px base unit, press/unlock animations, guardrails
- [Duolingo visual study](duolingo-ui/visual-study.md) — analysis of reference screenshots: whitespace, restrained green, illustration style
- [Duolingo example UIs](duolingo-ui/example-uis.md) — LOCAL screenshots/GIFs/clone code; use as reference before building
- [Duolingo agent skills](duolingo-ui/agent-skills.md) — installable Claude Code skills for Duolingo-style UI found online
- [Duolingo UI research sources](duolingo-ui/research-sources.md) — where the tokens came from, further reading
- [Agent connect design](halolesson/agent-connect-design.md) — dingcad-style token + commit API so agents build lessons live
- [Dev instance settings](halolesson/dev-instance-settings.md) — complex password requirement is off on the local dev DB
- [Share links](halolesson/share-links.md) — subject share link + preview page / export file design
- [Dark mode](halolesson/dark-mode.md) — Auto/Light/Dark in Appearance, default Auto, recoral mechanism, Duolingo dark palette
- [Subject icon picker](halolesson/subject-icon-picker.md) — create-subject form needs an icon choice
- [Outside tracker idea](halolesson/outside-tracker-idea.md) — brainstorm: orbit item that tracks learning done outside the app
- [Statistics](halolesson/statistics.md) — Stats tab, level history + per-attempt time/mastery stored, shared getStats for web and agents
- [Agent tab](halolesson/agent-tab.md) — Connect agent is a /agent tab, not a popup
- [PWA](halolesson/pwa.md) — installable: manifest, icons, sw.js (API never cached), prod-only registration
- [Export format v2](halolesson/export-format-v2.md) — .halo zip; subject page = share one, settings = full backup; ask on re-import; preview+pick
- [Skill graph vision](halolesson/skill-graph-vision.md) — subject page = 2D skill graph like the Map of Mathematics; server-side layout; prereq lock setting; edit mode
- [Skill levels vision](halolesson/skill-levels-vision.md) — 4 tiers, hearts, gold/silver/copper decay, procedural generators, recommender, retry wrong answers
- [Recommender research](halolesson/recommender-research.md) — FSRS, Duolingo HLR, Elo, misconception tagging, QuickJS sandbox for generators
- [LaTeX math](halolesson/latex-math.md) — KaTeX, trust off, $…$ / $$…$$ in exercise text; agents told in prompt/spec/MCP
- [Start flag](halolesson/start-flag.md) — start is a flag node linked to start skills via id "start", subject accent color, halo shading
- [Book artwork WebGL](halolesson/book-artwork-webgl.md) — spinning book is three.js (book3d.ts, lazy chunk); halo/base still flat CSS
- [Exercise answer types](halolesson/exercise-answer-types.md) — order, match, fill_blanks added; one module server/src/exercises.ts
