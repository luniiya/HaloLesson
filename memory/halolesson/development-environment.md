---
name: halolesson-development-environment
description: Local ports and browser-testing setup for haloLesson
type: project
---

# haloLesson development environment

*(as of 2026-11-05)*

- Port **7270** is open for testing haloLesson with bwl. Use it for browser-driven UI checks and screenshot reviews when the goal resumes.
- The API uses port 7246. Vite is configured for port 5173, so the UI review server needs to be exposed or started on 7270 for the bwl workflow.

*(2026-11-05, explicit user correction)* Use **bwl, not Playwright**, for browser testing and visual review. The user exposed port 7270 specifically for this workflow.

Related: [[halolesson-next-steps]]

*(as of 2026-11-06)* Machine LAN IP is now **192.168.2.222** (was .221), so bwl reaches the UI at `http://192.168.2.222:7270`. `web/vite.config.ts` still hardcodes port 5173, so start the UI with `bunx vite dev --host 0.0.0.0 --port 7270` from `web/` (API: `bun --watch src/index.ts` from `server/`). User says the existing code was written by Kimi and needs fixing.
