---
name: duolingo-visual-study
description: Visual analysis of Duolingo reference screenshots — live duolingo.com and styleguide mock
type: reference
---

# Duolingo Visual Study (from reference screenshots)

*(as of 2026-11-04)* — analysis of two screenshots: live duolingo.com landing (Norrly capture) and a Duolingo styleguide page (Kairaxis). Colors per [[duolingo-color-palette]].

## Live duolingo.com landing — key observations
- **Extreme whitespace.** The page is ~80% empty white. Hero content occupies only the middle band; nothing else competes. This is the biggest visual signature besides green.
- **Layout**: logo top-left; "SITE LANGUAGE: ENGLISH" top-right (tiny, gray, uppercase, chevron); centered 2-column hero — illustration cluster left, headline + two stacked full-width buttons right.
- **Headline is dark gray, NOT green.** "The free, fun, and effective way to learn a language!" in ~#4b4b4b bold sentence case. Green is reserved for logo, primary button, and illustrations. Don't over-green the text.
- **Buttons stack vertically, full column width**: green "GET STARTED" on top, white "I ALREADY HAVE AN ACCOUNT" with blue text below — both with the 3D bottom-shadow (see [[duolingo-components]]).
- **Footer**: full-width course carousel (flags + ENGLISH, SPANISH, FRENCH, GERMAN, ITALIAN, PORTUGUESE, MATH, CHESS) with left/right arrows and a 1px top border.
- **Illustration style**: flat cartoon characters (Duo owl + friends) clustered around a phone with gold coins; thick rounded limbs, simple oval eyes, no outlines/shadows — mascot-as-character, not decoration.

## Styleguide page — key observations
- Fixed white navbar (64px): green wordmark + owl, vertical divider, "STYLE GUIDE" micro-label; right nav links in 11–13px uppercase gray, letter-spaced.
- Section labels are 11px uppercase, 800 weight, 2px letter-spacing, light gray, with a hairline rule extending right.
- Badges: tiny uppercase pills, colored text on same-color 10–15% tinted bg (COMPLETED green, IN PROGRESS blue, FAILED red, STREAK orange, PREMIUM gold).
- Progress bars shown in green/blue/orange fills with right-aligned bold % values.
- Typography panel: only Display (48px) and lowercase "heading two" (28px) are green Feather Bold; H1 and body are gray — confirms green type is used sparingly, at display moments.
- Type samples annotated with blue size labels (11px bold) + weight caption beneath — nice pattern for styleguide presentation.
- Toggles: green when on, gray when off; labels in 14px 600 weight.

## Practical takeaways for halolesson rebuilds
- Whitespace first: if a Duolingo-style page feels "off", it's usually too dense.
- Restraint with green: logo + primary CTA + display headings + success states only.
- Illustration/mascot does the personality work so the layout can stay minimal.
