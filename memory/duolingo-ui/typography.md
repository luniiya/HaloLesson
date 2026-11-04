---
name: duolingo-typography
description: Duolingo font stack and type hierarchy — Feather Bold display, Mona Sans/Nunito body
type: reference
---

# Duolingo Typography

*(as of 2026-11-04)* — see [[duolingo-research-sources]].

## Fonts
- **Display/UI/headings**: Feather Bold (Duolingo's custom rounded sans; CDN copy at db.onlinewebfonts.com "Feather Bold"). Fallback: `'DIN Round Pro', 'Helvetica Neue', sans-serif`
- **Body**: Mona Sans (open-design) or Nunito (widely available Google Font, weights 400–900 — common substitute). Fallback: `-apple-system, BlinkMacSystemFont, sans-serif`
- **Code (rare)**: JetBrains Mono

## Hierarchy
| Role | Size | Weight | Line height | Notes |
|---|---|---|---|---|
| Display | 56px | 800 | 1.05 | onboarding hero |
| H1 | 32px | 800 | 1.15 | page title |
| H2 | 24px | 800 | 1.2 | section heading |
| H3 | 18px | 700 | 1.25 | card title, lesson row |
| Body large | 17px | 500 | 1.5 | lesson prompt |
| Body | 15px | 400 | 1.5 | prose |
| Caption | 13px | 600 | 1.4, +0.01em ls | XP counter, metadata |
| Button | 16px | 800 | 1.2, +0.02em ls, UPPERCASE | standard button label |
| Streak | 14px | 800 | 1.2 | number on flame |

## Principles
- 800 weight is the default for headings and buttons; 700 reads as weak.
- Heading sizes run 25–40% larger than typical product brands — big confident type, "Duolingo never whispers".
- Rounded letterforms only; no sharp serifs.
