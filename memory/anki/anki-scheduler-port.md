---
name: anki-scheduler-port
description: server/src/anki/scheduler.ts ports Anki 26.09 v3 answering + FSRS-6; verified identical to Python Anki with fuzz off
type: fact
---
*(as of 2026-11-07)* `server/src/anki/scheduler.ts` is a port of rslib scheduler/states + answering and fsrs-rs 6.6.2.
Checked against Python `anki` 26.9.4 (`ANKI_TEST_MODE=1`, fuzz off) on 10 card states (new, learning, review on time/late/early, big interval, leech, relearning, ivl 1) for both SM-2 and FSRS (custom params, retention 0.85): all four next states identical (0 diffs).
Only known difference: the fuzz random value comes from our own hash of card id + reps (Anki uses ChaCha), always within Anki's fuzz bounds.
For FSRS, days elapsed must come from card data `lrt`, falling back to the latest revlog (review.ts does this).
Related: [[anki-sync-protocol]], [[anki-link-feature]]
