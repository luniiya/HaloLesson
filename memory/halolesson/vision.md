---
name: halolesson-vision
description: What haloLesson is and why — Duolingo-style hot-recall practice engine, user-created lessons
type: project
---

# haloLesson — Project Vision

*(as of 2026-11-04)* — from user conversation + their Obsidian note `/home/ayaya/obsidian/main/03 - ressources/how to study.md`.

## The problem
User had a 4h study session with little to show for it. Their pipeline (past paper → correction → Ankify → loop) trains **cold recall** only (Anki: prompted, isolated retrieval). It misses **hot recall**: contextual retrieval where nobody names the method — you must interpret the situation, pick the tool, execute. That's what exams and mixed exercises actually require.

**IMPORTANT (2026-11-05): the Obsidian "how to study" note was written by another AI agent and the user never really read it — treat it as non-authoritative.** The user's own framing of the problem:
- Anki = "dumb memory": great at preserving answers long-term, but you forget the *underlying logic* if you never practice.
- They long ago stopped overloading Anki with too many cards / exercise-cards — that path causes crazy mental fatigue and failure. **Anki itself stays: it's an essential, actively-used part of their long-term memory system and is NOT going away.** haloLesson complements it, never replaces it.
- So the hole haloLesson fills is: **on-demand practice that rebuilds understanding**, separate from Anki's memorization loop. (Doesn't map cleanly onto the note's cold/hot recall terms; user is aware and doesn't care about the label.)

## How the product should feel (user's words, 2026-11-05)
- **Pull-based, the opposite of Anki's "study everything due today".** The user picks WHAT they want to practice; the system never dumps a giant due-pile on them.
- Within a chosen skill/deck, the system serves **procedural questions**, remembers right/wrong patterns, and tracks **how good you are per skill** (mastery).
- **Mastery is the addiction loop**: 3-stars-everywhere, cleared skills — the map literally represents what you know, and completing it feels good. (This makes stars/progress core to the design, unlike the note's "not streaks or XP" line.)
- Killer flow: you're in Anki, notice a concept got fuzzy → open haloLesson, do a few exercises (no hunting online for problems) → you're back up in minutes.

## The product
**One-liner (user, 2026-11-05): haloLesson fills the blank that Anki leaves** — the blank people usually fill by spending a huge amount of time on weird websites hunting for premade quizzes that suck. Anki = memorization/long-term retention; haloLesson = the practice-and-understanding layer Anki doesn't cover, with exercises that are yours and actually good.

**"Duolingo for everything"**: a web app where each user **creates their own Duolingo-style lessons** and practices them whenever needed.
- Log in → access your lessons.
- Lessons structured like Duolingo levels/skill paths, fully user-custom.
- First page/subject is very broad, then breaks into Duolingo-style levels per topic.
- The useful part is **adaptive practice** (mix older skills, bring mistakes back, schedule by recency + performance) — NOT streaks/XP for their own sake.
- Exercises schedule **skills**, not individual memory items (that's Anki's job).

## Hot-recall station concept (from the Obsidian note)
Each concept should have a reusable "station": short mental model + prerequisites, best explanation link, one worked example, 2–3 preselected exercises (basic / differently-presented / exam-level), hidden corrections, and latest result (method-selection success, independent execution, last-practised date).

## Tech & workflow
- Stack: **React + Bun** (+ other frameworks as useful on the go). Decided 2026-11-04.
- Order of work: **shell/base first** (app structure), then **UI, UI, UI** — user explicitly wants me (the agent) to do the UI.
- Design language: Duolingo style — see [[duolingo-color-palette]], [[duolingo-components]], and ALWAYS check local references in [[duolingo-example-uis]] before building screens.

## Decisions (2026-11-05)
- **Lesson authoring is AI-assisted.** User's answer to the authoring-burden problem: an API endpoint + agent flow, inspired by bwl's Control Room "copy prompt to give to an agent" button (user showed the bwl dashboard as reference). User wants it "more like dingcad" (unclear reference — ask). Built AFTER the UI pass, but the UI should already include a placeholder entry point (a "generate/copy prompt" style button somewhere sensible).
- **Real auth + multi-user: YES.** User overrode my single-user default — "it's ez as hell to implement in 2026". Login + accounts are in scope for the shell.
- Defaults accepted otherwise: station-model lessons; v1 exercise types MCQ + free-text + hidden correction; scheduling schema now, smarts later; link out to Obsidian rather than duplicating content.

Related: [[halolesson-open-questions]]
