---
name: duolingo-components
description: Duolingo component recipes — 3D tactile buttons, cards, inputs, progress bars, skill nodes
type: reference
---

# Duolingo Component Recipes

*(as of 2026-11-04)* — see [[duolingo-research-sources]]. Colors from [[duolingo-color-palette]].

## The signature move: 3D tactile press
Every interactive element gets a **chunky 4px solid bottom border/shadow** (no blur) in a darker shade of its own color. On `:active` the shadow is removed and the element does `translateY(4px)` — it physically "presses". This is the #1 thing that makes UI read as Duolingo.

## Buttons
- **Primary**: bg `#58cc02`, white text, `border-bottom: 4px solid #58a700`, radius 16px (12px also seen), padding 14px 24px, height ~48px, 15–16px font at 800 weight UPPERCASE. Hover: bg `#89e219`. Active: translateY(4px) + remove bottom border.
- **Secondary**: white bg, 2px border `#e5e5e5`, `border-bottom: 4px solid #e5e5e5`, text `#777777` (blue `#1cb0f6` for alternate CTAs). Hover: text darkens, border `#afafaf`.
- **Danger**: bg `#ff4b4b`, bottom `#cc3b3b`.
- **Orange/streak**: bg `#ff9600`, bottom `#cc7a00`.
- **Small variant**: 36px height, 13px font, 3px shadow, 10px radius.
- **Disabled**: opacity 0.45, pointer-events none.
- CSS pattern: `box-shadow: 0 4px 0 var(--accent-active);` works as alternative to border-bottom.

## Cards / lesson tiles
- White bg, 2px border `#e5e5e5`, `border-bottom: 4px solid #e5e5e5`, radius 16px, padding 16px.
- Hover: lift 2px (`translateY(-4px)` on some variants) + soft shadow `0 12px 32px rgba(0,0,0,0.08)`.

## Skill tree node (lesson bubble)
- 80×72px circle (radius 50%), skill-color tinted bg, `border-bottom: 6px solid` darker variant.
- Locked = gray, active = green, pulses scale 1.0→1.05 every 1.6s.

## Inputs
- White bg, 2px border `#e5e5e5`, radius 12px, padding 12px 16px, 15px 600-weight font.
- Focus: border `#1cb0f6` + ring `0 0 0 3px rgba(28,176,246,0.2)`.

## Progress bar
- Track `#e5e5e5`, fill `#58cc02` (or `#ff9600` for streak), radius 9999px, height 12–16px, fill animates 320ms ease-out.

## Badges / chips
- Pill radius 9999px, 12px bold UPPERCASE text, colored text at 100% on same-color bg at 10–15% opacity (green completed, blue in-progress, red failed, orange streak, gold premium).

## Toggles
- 48×28px track (radius 14px), 22px white thumb; checked: track turns owl green, thumb slides 20px.

## Streak counter
- Orange-tinted pill: fire emoji + number at 800 weight in `#ff9600`.

## Dark theme variant
- Sections on `#100f3e`; cards `rgba(255,255,255,0.06)` bg with `rgba(255,255,255,0.08)` border; buttons stay saturated.
