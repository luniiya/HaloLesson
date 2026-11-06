---
name: user-preferences
description: How the user likes to work — token-conscious, clears context, encourages heavy bwl browser use
type: fact
---

# User Preferences

*(as of 2026-11-05)*

- **Token/cost conscious.** Swaps models and uses `/clear` to reset context. Anything important MUST live in `memory/` on disk — assume the conversation can be wiped at any time.
- **Browser use**: user explicitly encourages heavy use of the bwl (Bloom Web Link) browser — "don't stop yourself from abusing bwl" (2026-11-05). Prefer bwl over FetchURL/curl for real web browsing; use profiles per AGENTS.md (`dev` by default).
- Communication style: casual, fast, low-punctuation. Wants momentum over ceremony — short progress updates, get to building.
- Study-system context: lives in Obsidian (`/home/ayaya/obsidian/main/`); Anki handles cold recall; haloLesson covers hot recall. See [[halolesson-vision]].
- **UI icons** (2026-11-05): do not use ASCII arrows or ad-hoc glyph icons. Use Tabler icons (`@tabler/icons-react`) wherever an interface icon is needed. Custom brand/illustration artwork remains allowed.

*(2026-11-06)* Don't do bwl visual checks on your own initiative. User interrupted one ("omg ur annoying", "dont visual check"). Typecheck/tests are enough unless they ask for a look.
*(2026-11-06, refined)* Exception: visual self-checks are fine when working fully autonomously. Rule is now in CLAUDE.md and AGENTS.md.
