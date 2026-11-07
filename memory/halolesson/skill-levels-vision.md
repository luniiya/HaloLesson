---
name: skill-levels-vision
description: 2026-11-07 vision for skills - 4 difficulty tiers, hearts, gold/silver/copper decay, procedural generators, recommender, failed questions repeat
type: decision
---

*(as of 2026-11-07)* The user's vision for redefining skills (not built yet):

- A skill is a topic like "integrals". Each skill has 4 tiers: Easy, Intermediate (the user wants a shorter word), Hard, Expert. Each tier has its own questions.
- Tiers unlock in order: you must clear Easy before Intermediate, and so on.
- Skill settings decide how many questions a session has and how many hearts. Losing every heart ends the session and sends you back to the main menu.
- Clearing Expert turns the skill gold (like Duolingo's gold coin node). If it isn't practiced for about 2 months it turns silver, and after more than a year copper. Only a cleared Expert can decay.
- Questions come either from a big premade pool per tier, or from code that generates them on the fly (procedural, so you rarely see a repeat). The user will say more about generation later.
- Recommender: record as many stats per attempt as possible (time taken, wrong count, time of day, ...) and pick questions with a strong algorithm based on research. Failed sessions still count and should bring up your hardest items.
- Questions you got wrong always come back at the end of the session, like Duolingo. This applies to premade and generated questions.
- Open worry: generators are code. The user doesn't like the idea of agents running code on the server.

Related: [[skill-graph-vision]], [[subject-path-ui]], [[statistics]]

## Decisions *(as of 2026-11-07)*
- The tiers are Easy / Medium / Hard / Expert, unlocked in order. You can't skip ahead to Expert.
- Each tier has its own question pool. The picker serves the hardest questions *for this user* from the current tier's pool. The user wants the most "brain overheating" questions every time, so don't argue for the 85% rule again.
- Running out of hearts doesn't count toward clearing the tier, but every answer is recorded and weighs heavily in the recommender.
- Badge colors: clearing an Expert session makes the skill gold. After about 2 months without practice it turns silver, and after a year copper. Another Expert session makes it gold again.
- There are no real exercises yet (test data only), so no migration is needed.
- Still open: does clearing a tier take one session finished with hearts left, or several?

## Requested next *(as of 2026-11-07)*
- Sound effects for right and wrong answers.
- More answer types beyond multiple choice and free text: typing the answer, matching/linking pairs, and others.
- No voice or speech features for now.

## Progress display and unlock tier *(as of 2026-11-07)*
- Skill nodes drop the 3 stars. They show a fill like the tracker level on the main menu: 0/3 nothing cleared, 1/3 Easy, 2/3 Medium, 3/3 Hard. Clearing Expert turns the node gold, which then decays to silver and copper.
- A subject setting picks the minimum tier a skill must clear before the skills linked to it unlock (default Easy).
- *(2026-11-07)* The start-skill marker should be a real Duolingo-style flag placed around the start circle, not the current small "Start" pill. The user is sending a screenshot.

## Built *(as of 2026-11-07, uncommitted)*
- Server: `memory.ts` is an FSRS-6 port, replayed from attempts and never stored. `recommender.ts` (pickExercises, skillInsight) serves the questions you're likeliest to fail; a wrong last answer gets +0.5, and unseen questions score 0.45. In `practice.ts`, sessions live in the `practice_sessions` table and wrong answers requeue at the end.
- DB: exercises.tier and concepts_json; skills.session_size and hearts; skill_progress.tiers_cleared and expert_cleared_at; subjects.unlock_tier; attempts.session_id and retry. Old stars>0 rows were migrated to tiers_cleared=1.
- Routes: POST /api/skills/:id/sessions {tier}, GET /api/sessions/:id, POST /api/sessions/:id/answer, POST /api/sessions/:id/quit, GET /api/skills/:id/insight. Agent: GET /api/agent/skills/:id/insight and MCP hl_get_insight. putSkill takes tier, concepts, sessionSize and hearts; putSubject takes unlockTier.
- Web: the SkillNode ring has 3 segments plus medal colors. Also new or reworked: SkillPreview (tier chips, struggles), PracticePage (hearts, sounds via lib/sounds.ts, end screens), subject dialog tabs (Details/Look/Progression), and session size and hearts inputs in MapEditor.
- Not done yet: procedural generators (QuickJS sandbox idea), more answer types, the Duolingo-style start flag.

*(as of 2026-11-07)* User: the unlock-in-order setting lives only in subject settings (removed from the map editor), and new subjects default to unlockInOrder true with unlockTier hard (`DEFAULT_UNLOCK_IN_ORDER` and `DEFAULT_UNLOCK_TIER` in shared, used by createSubject and the agent putSubject). Existing subjects and imported files keep their stored values. Open issue: a skill with no Hard exercises can never count as finished under Hard, so its links stay locked.
