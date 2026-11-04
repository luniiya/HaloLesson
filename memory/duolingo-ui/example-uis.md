---
name: duolingo-example-uis
description: Local example Duolingo UI assets (screenshots, GIFs, working clone code) — USE THESE AS REFERENCE when building
type: reference
---

# Duolingo Example UIs (local assets)

*(as of 2026-11-04)*

> **IMPORTANT — use these as reference.** Before building or reviewing any Duolingo-style UI in this workspace, open the files below and match against them. Studying these examples beforehand beats working from token tables alone; the tables ([[duolingo-color-palette]], [[duolingo-components]]) describe the rules, these files show what "right" actually looks like.

## Assets

### Screenshots & recordings — `memory/duolingo-ui/examples/screenshots/`
- `duolingo-original-exercise.gif` — **recording of the REAL Duolingo "Write this in Spanish" exercise screen**. The canonical lesson-exercise reference.
- `duolingo-clone-exercise.gif` — recording of the community clone of the same exercise; useful to see how close a rebuild can get with plain CSS.
- `duolingo-com-landing.png` — live duolingo.com landing page (1440×900): extreme whitespace, restrained green, stacked hero buttons, footer flag carousel.
- `duolingo-styleguide-page.png` — community styleguide page: badge pills, progress bars, toggles, typography panel with size annotations.

### Working code — `memory/duolingo-ui/examples/duo-exercise-clone/`
Plain HTML/CSS/JS recreation of the word-bank translation exercise (from github.com/KasraTabrizi/duolingo-exercise-project, educational use). `index.html`, `style.css`, `script.js`, `exercises.js`, `assets/duo.svg`.

Key implementation patterns worth copying:
- Word tiles: `box-shadow: 0 3px 0 0 <grey>` + on `:active` → `translateY(2px); box-shadow: none` — the tactile press in 3 lines.
- Selected-word placeholder: empty `.word__container:empty` gets grey bg, so the bank keeps its shape as words move.
- Destination zone: div with 2px top+bottom grey borders = the ruled-line answer area.
- Speech bubble: white box, 2px grey border, 15px radius; translatable word marked with `border-bottom: 2px dashed`.
- Footer bar: fixed, full-width, 2px top border, SKIP left / CHECK right.
- Uses Fredoka (rounded Google font) as a Feather Bold stand-in; text color `#3c3c3c`.

## Anatomy of the real exercise screen (from duolingo-original-exercise.gif)
- Top: grey ✕ close button + full-width progress bar (grey track, green fill).
- Centered content column (~750px): bold dark-grey prompt ("Write this in Spanish"), character illustration (Lily) with a tailed speech bubble holding the sentence.
- Answer area: empty space marked by 2px horizontal ruled lines (notebook-paper feel).
- Word bank: white tiles with 2px border + grey bottom shadow; includes **distractor words** not needed for the answer.
- Footer: SKIP (white, grey text) — "USE KEYBOARD" ghost button (keyboard icon, grey uppercase) — CHECK (**grey/disabled until an answer is placed**, then turns green).
- Whitespace dominates; nothing is cramped.

## Gaps to fill later
- No local example yet of the **skill-tree / lesson-path home screen** (circular nodes on a winding path) — grab one when building that screen.
