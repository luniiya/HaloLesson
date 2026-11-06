---
name: statistics
description: Statistics tab — what's stored (level history, answer time, mastery per attempt), scopes, charts
type: project
---
*(as of 2026-11-07)* User asked for a Statistics tab: dropdown to pick Everything / a subject / a tracker, "as many stats as we can", level over time, Duolingo style, built with the dataviz skill.

Built:
- Stored: `level_history` table (every rating change, null = cleared, seeded from existing levels), `attempts.duration_ms` (client-timed, >30 min dropped) and `attempts.mastery_after`.
- `server/src/stats.ts` `getStats` shared by `GET /api/stats`, agent `GET /api/agent/stats` and MCP `halo_get_stats`. Ranges 7/30/90/365/all, `tzOffset` for local days. Streaks are always all-time.
- Backups carry `levelHistory` per subject and `attempts` per exercise.
- Web `/stats` (`routes/StatsPage.tsx`, `components/charts.tsx`): stat tiles, level step chart, activity columns (weekly past 120 days), mastery line, calendar heatmap, weekday + hour columns, level dumbbells, breakdown/skills lists. Every chart has a Table view.
- Chart gold `--chart-gold` #d99a00 light / #dba400 dark (validated). Tests: `server/test/stats/`.
Related: [[outside-tracker-idea]], [[feature-parity-rule]]
