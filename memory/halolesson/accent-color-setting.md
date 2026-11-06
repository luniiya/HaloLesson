---
name: accent-color-setting
description: How the per-user accent color works (CSS var, tokens, storage, settings page)
type: decision
---

# Accent color setting

*(as of 2026-11-06)*

- One CSS var `--accent` on `<html>` drives everything: Tailwind tokens `accent`, `accent-deep`, `accent-light`, `accent-pale` (renamed from Duolingo's `owl-*`) are `color-mix` shades of it in `web/src/app.css`; book artwork/base/logo use the same vars.
- Stored per user in `users.accent_color` (null = `DEFAULT_ACCENT`); shared `ACCENT_PRESETS`, `isValidAccent` in `packages/shared`. Saved via `PATCH /api/account { accentColor }`, no password needed.
- `web/src/lib/theme.ts` applies it and caches in localStorage so the login page paints with the last-used color.
- UI: Settings > Appearance (`AppearanceSettings.tsx`): presets, custom picker, live preview, debounced save.
- Not themed on purpose: subject colors, gold perfected levels, yellow halo, blue focus/nav-selected highlights.

Related: [[halolesson-branding]]
