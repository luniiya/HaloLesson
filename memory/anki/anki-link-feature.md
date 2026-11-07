---
name: anki-link-feature
description: Link an Anki account (AnkiWeb or self-hosted sync server), merged stats, review Anki cards in a Flashcards tab
type: decision
---
*(as of 2026-11-07)* User request: "connect to ur anki account on an anki server so u can do ur cards from web and any device ... so we can merge the stats of anki with halo lesson".
Decisions from the user *(as of 2026-11-07)*:
- Linking lives in Settings (Anki account section). Default server URL = AnkiWeb, custom URL allowed.
- A new "Flashcards" tab in the left nav, directly under Learn, visible ONLY when an Anki account is linked.
- Never store the Anki password (only the sync host key, encrypted, never returned to clients/agents/exports).
- The user explicitly asked for a visual check of this feature (exception to the no-visual-check rule).
- Anki stats are merged into the Statistics page, labelled as a separate source.
Related: [[user-anki-server]], [[anki-sync-protocol]], [[statistics]]
