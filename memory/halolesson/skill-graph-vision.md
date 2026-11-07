---
name: skill-graph-vision
description: Subject page becomes a 2D skill graph (Map of Mathematics / Obsidian graph, Duolingo style), layout computed server-side
type: decision
---

# Skill graph vision

*(as of 2026-11-07)*, from the user:

- Duolingo's path is one-dimensional. haloLesson subjects should be a **2D plane of skills**, like a node graph with gravity and weights (Obsidian graph view, graph theory).
- Main inspiration: Dominic Walliman's "Map of Mathematics" (the user's wallpaper at `~/Wall/Dark/map math dark.png`). If a subject held all of maths, it should end up looking like that map, but in Duolingo style.
- A skill can link to any number of other skills.
- **No physics in the browser.** The UI never moves around; the server works out where each node goes.
- Every subject gets a setting: "finish the previous skill to unlock the next one" (prerequisite locking).
- The subject page needs a **view mode and an edit mode** (like the Learn page's edit mode), so users can create skills and link them.
- Users currently have no way to create skills; they need one.
- Users writing exercises/questions themselves: unsure, too time-consuming for humans; if ever, "in a very long time". Agents write exercises.
- Wanted first: a way to create a test subject with random skills, to try things out.

Related: [[halolesson-subject-path-ui]], [[feature-parity-rule]]

## Decisions *(as of 2026-11-07)*, user answers
- **Units become regions**: coloured areas of the map whose skills cluster together; links may cross regions. Regions are placed automatically for now (maybe user-placed later).
- **Links have no direction.** A subject has a starting point. Finishing a skill unlocks every skill linked to it. With the "unlock in order" setting on, a skill is open only if it is a start or linked to a finished skill.
- **Layout fully automatic** for now. Pinning (maybe right-click to pin) is a later idea, not now.
- **Test subject**: a dev-only server script, e.g. `bun run seed:graph <username> <count>`, not a button in the app.

## Built *(as of 2026-11-07)*
- Server: `server/src/skillGraph.ts` (regions = units, skills, links, `isSkillLocked`, force layout). Tables/cols: `skill_links(a<b)`, `skills.x/y/is_start`, `subjects.unlock_in_order/layout_hash`. Layout reruns lazily in `getSubject` when the structure hash changes (~450 ms fresh for 400 skills, ~160 ms incremental, 2 ms otherwise).
- "Finished" = 1+ star. No start marked → first skill is the start. Practice of a locked skill is refused server-side.
- Web: `SkillMap.tsx` (pan/zoom/pinch, region blobs, links), `MapEditor.tsx` (edit mode), `UnlockInOrderToggle` also in the subject's Edit dialog. Old `SkillPath.tsx` removed.
- Agent: `linkSkills`/`unlinkSkills` ops, `halo_link_skills` MCP tool, putSkill `start`/`linkTo`, putSubject `unlockInOrder`. Export carries `links`, `start`, `unlockInOrder`.
- Dev seed: `bun run seed:graph <username> [count] [--unlock]` from `server/`.
