---
name: exercise-answer-types
description: Five exercise types (multiple_choice, free_text, order, match, fill_blanks); all logic in server/src/exercises.ts
type: decision
---

*(as of 2026-11-07)* Exercises come in five types: `multiple_choice`, `free_text`, `order`,
`match`, `fill_blanks`. The user asked for more answer types; `free_text` already covered typing.

- content_json keys match the export/agent fields: options+correctIndex, answers, items, pairs
  ([left, right][]), blanks (string[][], one list per `___` in the prompt; `BLANK` in shared).
- `server/src/exercises.ts` holds everything per type: contentJson, contentFields, practiceFields
  (seeded shuffle by session+exercise id, never the answer order), checkAnswer, answer texts.
  practice.ts, dataExport.ts and agent ops.ts all call it.
- Answers sent by the browser: order = items in sequence, match = right item per left item,
  fill_blanks = one string per blank; text compared ignoring case and spacing.
- The old CHECK on exercises.type was dropped by a one-time table rebuild in db.ts.
- Web inputs: `web/src/components/ExerciseAnswer.tsx` (tap-to-order, tap-to-pair, inline blanks).
- Tests: `server/test/practice/answer-types.test.ts`.

Related: [[skill-levels-vision]], [[latex-math]], [[feature-parity-rule]]
