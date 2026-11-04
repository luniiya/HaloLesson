---
name: halolesson-recoral-reference
description: ../recoral is the stack + auth reference for haloLesson — Bun monorepo, hand-rolled cookie auth, React 19 + Vite + Tailwind 4
type: project
---

# recoral as Stack/Auth Reference

*(as of 2026-11-05)* — user said: "for the user auth inspiration look at `../recoral`, you'll get a shit ton of inspo, it uses the same stack as this project will use. Just not the same UI."

Path: `/home/ayaya/dev/recoral` — **use the `react` branch** (the full React rewrite; repo's `main` is an older non-React version). As of 2026-11-05 the repo is checked out on `react`.

**haloLesson is web-only: React, NOT React Native — no mobile app, no Capacitor, ever (user, 2026-11-05).** Ignore recoral's `mobile` workspace and Capacitor deps entirely.

## What's there
- **Bun workspaces monorepo**: `server`, `web`, `mobile`, `packages/*` (shared types in `@recoral/shared`).
- **Server** (`server/src/index.ts`, 956 lines): plain `Bun.serve`, no framework. Hand-written route handlers.
- **DB**: `bun:sqlite`, WAL mode, `DATA_DIR` env, schema created with `CREATE TABLE IF NOT EXISTS` in `server/src/db.ts`.
- **Auth** (`server/src/auth.ts`, 513 lines): hand-rolled username/password with session-cookie table — sessions list/revoke, login lockout (5 attempts → 15min), last-seen throttling, admin users, UA sniffing for session device labels. Self-contained, no auth library.
- **Web**: React 19 + Vite 8 + Tailwind CSS 4 (@tailwindcss/vite) + react-router 8 + @preact/signals-react. TypeScript strict-ish, Playwright e2e. Capacitor for mobile.

## Takeaways for haloLesson
- Same shape works: `server` (Bun.serve + bun:sqlite) + `web` (React+Vite+Tailwind) + `packages/shared` for shared types. Skip `mobile`/Capacitor for v1 unless asked.
- Auth can be adapted from `server/src/auth.ts` almost wholesale (rename cookie, drop recoral-specific fields). Verify password hashing approach when copying.
- Tailwind 4 + CSS custom properties map cleanly onto the Duolingo token set in [[duolingo-color-palette]].

Related: [[halolesson-vision]], [[halolesson-next-steps]]
