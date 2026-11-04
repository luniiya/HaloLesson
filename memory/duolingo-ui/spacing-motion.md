---
name: duolingo-spacing-motion
description: Duolingo spacing scale, layout widths, motion timings, and usage guardrails
type: reference
---

# Duolingo Spacing & Motion

*(as of 2026-11-04)* — see [[duolingo-research-sources]].

## Spacing & layout
- Base unit 4px; scale: 4, 8, 12, 16, 24, 32, 48, 64.
- Container max-width ~1080–1440px, 24px gutter.
- Lesson tree column: ~320px wide, centered on desktop.
- Radius language: 16–20px cards, 12–16px buttons, 12px inputs, 9999px chips/progress bars, 50% skill nodes.
- Generous whitespace — "double your margins before adding decoration".

## Motion
- Button press: 180ms.
- Progress fill / skill-node unlock: 320ms ease-out.
- Unlock easing: `cubic-bezier(0.34, 1.56, 0.64, 1)` (back-out, slight overshoot).
- Active skill node pulse: 1.0→1.05 scale, 1.6s cycle.
- Mascot: blinks every 4–6s; jump on streak milestones (480ms spring).

## Guardrails (what makes it read as Duolingo)
- High-saturation owl green + chunky 4px bottom shadows + rounded geometry must appear together; flat green buttons alone don't read as Duolingo.
- Reserve oversized bold type for encouragement/feedback moments (lessons, streaks, progress).
- Playful motion only around progress state changes — no generic bounce on every control.
- Personality in low-risk spots: 404s, empty states, button micro-copy.
- 2–3px solid borders always; never hairlines.
