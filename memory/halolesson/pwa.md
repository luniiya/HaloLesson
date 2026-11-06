---
name: pwa
description: haloLesson is an installable PWA — manifest, icons, hand-written sw.js, API never cached
type: project
---
*(as of 2026-11-07)* User asked for PWA. Added `web/public/manifest.webmanifest`, `web/public/icons/*` (rendered from favicon.svg with rsvg-convert), `web/public/sw.js` (network-first pages, cache-first hashed assets, never /api or /mcp), registered in `main.tsx` only in production builds. Bump `CACHE` in sw.js if the caching strategy changes.
