---
name: anki-sync-protocol
description: How the Anki sync protocol v11 works (read from rslib/src/sync at tag 26.09.4) - framing, endpoints, merge rules, safe client strategy
type: reference
---
*(as of 2026-11-07, Anki 26.09.4 source, fsrs crate 6.6.2)*
- Every call: POST `<base>/sync/<method>`, header `anki-sync: {"v":11,"k":hostKey,"c":"<ver>,<hash>,<os>","s":sessionKey}`, body = zstd(JSON), `Content-Type: application/octet-stream`. Response body is zstd (header `anki-original-size`). Errors: non-2xx with plain text. 308 + Location = move to another endpoint (AnkiWeb shards). Default base https://sync.ankiweb.net/.
- hostKey: body `{"u","p"}`, k="" -> `{"key"}`. 403 = bad login.
- meta: `{"v":11,"cv":"anki,<ver> (<hash>),<os>"}` -> `{mod,scm,usn,ts,msg,cont,hostNum,empty,media_usn}`. Same mod = no changes; different scm = full sync required.
- Normal sync order: start `{minUsn, lnewer}` -> server graves `{cards,notes,decks}`; applyGraves `{chunk}` (only if we deleted); applyChanges `{changes:{models:[],decks:[[],[]],tags:[]}}` (+conf/crt only if lnewer) -> server's changes; chunk `{}` until done (revlog/cards/notes rows as arrays); applyChunk `{chunk:{done,revlog,cards,notes}}`; sanityCheck2 `{client:[[new,lrn,rev],cards,notes,revlog,graves,models,decks,deck_config]}` (server zeroes due counts and graves) -> `{status:"ok"|"bad"}`; finish `{}` -> new mod ms. abort `{}` rolls the server transaction back.
- Server keeps our card if its copy wasn't changed since our usn, or our mtime is newer. Revlog rows are INSERT OR IGNORE by id.
- download `{}` -> raw SQLite file (schema 18, zstd'd). Non-destructive (server only bumps usn). upload overwrites the remote collection: never use without explicit user confirmation.
- Schema 18: decks/deck_config/notetypes are protobuf blobs (decks.kind field 1 = Normal{config_id=1, desired_retention=10}; deck_config.config = DeckConfig.Config: learn_steps=1, relearn_steps=2, fsrs_params_4/5/6=3/5/6, new_per_day=9, reviews_per_day=10, initial_ease=11, easy_mult=12, hard_mult=13, lapse_mult=14, ivl_mult=15, max_ivl=16, min_lapse_ivl=17, grad_good=18, grad_easy=19, leech_action=21, leech_threshold=22, cap_answer_secs=24, desired_retention=37). config table key/val JSON: fsrs, fsrsShortTermWithStepsEnabled, rollover, creationOffset.
- card.data JSON: s (stability), d (difficulty 1-10), dr, decay, lrt (last review secs), pos, cd.
Related: [[anki-link-feature]], [[user-anki-server]]
