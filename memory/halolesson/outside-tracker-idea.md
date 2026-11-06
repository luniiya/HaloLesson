---
name: outside-tracker-idea
description: Idea (brainstorming): a third orbit item next to folders/subjects that tracks progress on something learned OUTSIDE haloLesson
type: project
---

*(as of 2026-11-06)* User wants a third kind of library item beside folders and subjects: looks
like a subject circle on the orbit, but has no course/skills/exercises. It's just a tracker for
something the user is learning elsewhere. Name and mechanics not decided yet; brainstorming
started. Candidate names offered: Tracker, Quest, Pursuit, Side quest, Goal.

Related: [[library-organisation]] [[subject-path-ui]] [[feature-parity-rule]]

*(2026-11-06, decided)* Name: **Tracker**. Build it.
- Same as a subject on the orbit (name, description, color, icon, folders, archive/trash, drag) but no skills inside.
- Main thing: a **self-evaluated level 0-10** with a slider whose label changes as you drag
  (user's anchors: 0 = know nothing, 4 = mid, 5 = ok, 8 = good, 9 = very good, 10 = the best). **Subjects get this level too**;
  subjects also keep their completion (skill progress).
- Clicking a tracker: its own page with the level slider + notes (Claude's proposal, user was unsure).
- Header: replace separate Subject/Folder buttons with one **Add** button -> pick Subject / Tracker / Folder.

*(2026-11-06)* Visual (user sent a Duolingo screenshot: orange star node + progress ring + "LEVEL UP" speech bubble above): show level/progress as the orbit circle's **progress ring** plus a bubble/badge. Plan: tracker ring = level/10; subject ring = skill completion, level shown in a small bubble badge.

*(2026-11-06)* User: subject ring shows **level on one half and progress on the other** ("left level, right progress or the opposite"). Built as: right half = skill completion, left half = level, both fill from the top, gaps top and bottom. Tracker ring = level only, full circle.

*(2026-11-06, built)* Tracker = subjects row with `type = "tracker"` (+ `level` INTEGER null, `notes` TEXT) so it reuses folders/archive/trash/drag/export/agent ops. `completedCount` = skills with >= 1 star. Shared: SUBJECT_TYPES, LEVEL_LABELS, MAX_LEVEL, isLevel. Server: checkLevel in subjects.ts; agent putSubject takes type/level/notes; putUnit refuses trackers; export keeps type, level+notes only in full backups. Web: AddMenu (Subject/Tracker/Folder), LevelSlider, TrackerView (level + autosaved notes), LevelCard on subject pages, orbit rings (.orbit-tracker / .orbit-split) + level bubble. Tests: server/test/subjects/tracker.test.ts.

*(2026-11-06, user feedback)* Labels: 8 "Very good", 9 "Brilliant" (was Good / Very good). Ring arcs must have ROUNDED ends (SVG round linecaps, not conic). Level bubble on the orbit only in Edit mode; clicking it opens a popup with the slider. Level card removed from subject pages (tracker page keeps its slider + notes).

*(2026-11-06)* User: "we shouldnt have a add button in not edit mode" -> Add menu only in Edit mode.

*(2026-11-07, user feedback)* Level is set ONLY from the edit-mode pill popup on the main page, never on subject/tracker pages ("we dont wanna waste space for something the user will use once every 3 months"). Tracker page = notes only. In edit mode, the bottom gap of a subject ring gets a status bubble (skills done) to mirror the top level pill.
