---
name: user-anki-server
description: The user's own self-hosted Anki sync server (anki.luniiya.me / LAN 192.168.2.122:27701), user ayaya
type: fact
---
*(as of 2026-11-07)* The user runs their own Anki sync server. They said "i think it's anki.luniiya.me" and to use it for Anki-link testing.
Their Anki desktop profile ("User 1", ~/.local/share/Anki2/prefs21.db) has customSyncUrl `http://192.168.2.122:27701/` and syncUser `ayaya`.
It holds their REAL collection: only non-destructive calls (hostKey, meta, download) are acceptable there; write-back tests go to a throwaway local server.
*(as of 2026-11-07)* User: the default server URL in the haloLesson link form must be AnkiWeb (https://sync.ankiweb.net/), with a custom URL option.
Related: [[anki-sync-protocol]], [[anki-link-feature]]
*(as of 2026-11-07)* The user gave a dedicated test account on anki.luniiya.me in chat for testing the Anki link. Credentials are deliberately NOT written to disk; ask the user again if needed.
