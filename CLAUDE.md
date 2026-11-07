# Agent instructions

- **Never commit, branch, stash or push.** The user manages git. Leave your changes
  uncommitted in the working tree.

- **Don't visually check the app yourself while the user is working with you** (no
  bwl/browser screenshots of the UI, no "let me take a look"). The user does the visual
  testing. Typecheck and tests are your verification. Check visually only when you are
  working fully autonomously (no user in the loop), or when the user explicitly asks.

- Whenever searching online, if the search tool fails, just use curl from
  this computer.

## Browser: Bloom Web Link (bwl)

You have a headless anti-detection browser (Camoufox) available over MCP
(`bloom-web-link`, http://192.168.2.122:9377/mcp). Use the bwl tools for any
web browsing instead of a built-in browser or curl: they get past bot detection
and keep cookies/logins.

- Your dedicated browser profile is `main`. Always open tabs with
  `bwl_create_tab({ url, profile: "main" })`. A profile is a separate browser
  with its own fingerprint, cookies, logins and history, so stay in yours.
- Other profiles exist (`heaven`). Use another one only when there is a real
  reason (the user asks, or the login you need lives there) and say which
  profile you used and why.
- For a throwaway session that must not touch saved logins, use
  `profile: "burner"`.
- Workflow: `bwl_create_tab` -> `tabId`; `bwl_snapshot` for element refs
  (`includeScreenshot: false` when you don't need the image; `bwl_read_text`
  is cheaper for just reading); interact with `bwl_click`, `bwl_type`,
  `bwl_select`, `bwl_scroll`, `bwl_navigate`; `bwl_batch` for several steps;
  `bwl_wait` for slow pages. Snapshot again after anything that changes the
  page, since old refs go stale.
- Close tabs with `bwl_close_tab` when done unless the user wants them kept.
- Files: `bwl_save_page({ tabId })` saves the current page; click-triggered
  downloads are captured too. `bwl_downloads({ tabId })` lists them and
  `bwl_downloads({ tabId, downloadId })` returns the contents.
- The user can watch and take over every tab in the dashboard. On a captcha or
  a login you can't complete, ask them to finish it there, then continue.

## Feature parity: user interface and agent interface

Every feature must exist in **both** interfaces: the web UI (for people) and the
agent interface (REST `/api/agent/*` commits and MCP tools, for LLM agents).
Never ship a feature in only one of them.

- Adding or changing a user-facing capability (rename, recolor, reorder, archive,
  trash, restore, folders, sharing, ...)? Add the matching agent operation in
  `server/src/agent/ops.ts`, expose it in `server/src/agent/mcp.ts`, and describe
  it in `server/src/agent/prompt.ts` so agents know it exists.
- Adding an agent operation? Give the user the same thing in the web UI.
- Put the logic in one shared server module and call it from both the HTTP route and
  the agent op, so the two can never drift apart.
- Test both entry points (`server/test/<area>/`), and keep the data export/import format in sync
  when the feature changes what is stored.
- Exceptions need the user's explicit say-so (for example, destructive actions the
  user wants to keep human-only, like permanently deleting from the trash).

## Tests

Write unit tests for as much as you can, and keep them fast: test run time matters.

- Tests live in `server/test/<area>/*.test.ts` and run with `bun test`. Each area is a folder, so you only run the area you changed:
  `bun run test:<area>` from `server/` (for example `bun run test:agent`). Use `bun run test` for everything before committing.
- Areas so far: `auth` (register, login, lockout, sessions), `account` (profile and password changes, deletion), `admin` (users, server settings),
  `data` (import and export), `agent` (tokens, agent API, MCP), `practice` (sessions, tiers, hearts, medals, FSRS recommender, concept insight), `subjects`, `stats` (statistics, level history), `graph` (skill map: regions, links, layout, unlock in order).
  When you add an area, add its folder and a `test:<area>` script in `server/package.json`, and list it here.
- `server/test/setup.ts` (preloaded via `bunfig.toml`) points `DATA_DIR` at a fresh temp directory, so tests never touch `data/`.
  Every run shares one database, so each test creates its own users with unique names instead of relying on global state.
- Prefer calling module functions directly. Go through `Bun.serve` routes only when the HTTP behavior itself is what you're testing.
  No sleeps or network calls, and no fixtures bigger than the test needs.
- Changed an area? Run that area's tests. Changed shared code (`db.ts`, `packages/shared`, auth helpers)? Run them all.

## Persistent Memory Protocol

Your working directory is not just a workspace — it is your long-term memory.
Everything you learn must survive context compaction and session restarts by
living on disk, not in the conversation.

### Layout

- `memory/INDEX.md` — one line per note: `- [title](file.md) — one-line hook`
- `memory/<topic>/<slug>.md` — one atomic note per file. kebab-case filenames.
  Use subdirs to group by domain once a topic has 3+ notes (e.g. `memory/user/`,
  `memory/project-x/`, `memory/reference/`).

### Note format

Every note starts with frontmatter:

```markdown
---
name: <slug>
description: <one line, used to judge relevance without opening the file>
type: fact | decision | project | reference
---
```

Body: the fact itself, dated. Cross-link related notes with `[[slug]]`.

### The two hard rules

1. **Search before you answer.** If you're not certain, check `INDEX.md`
   first, then read the matching note(s), before answering. Don't guess or
   re-derive something that's already written down. Only fall back to an
   external source (web, filesystem, asking the user) if the workspace has
   nothing.
2. **Write immediately after you learn.** The moment new info surfaces —
   user states a fact, you figure something out, an external lookup
   resolves something — write or update the note *right then*, not
   "later." If it isn't on disk, it doesn't count as known.

### Non-negotiables

- **Date every fact.** `*(as of YYYY-MM-DD)*` on every claim that could go
  stale. No exceptions.
- **Never overwrite, always append.** If something changes, add the new
  fact below the old one with its own date — don't delete or edit the old
  line. History must stay reconstructable.
- **Keep notes atomic and small.** One fact/decision per file. If a note is
  covering two unrelated things, split it.
- **Keep INDEX.md in sync.** Every new note gets a line the same turn it's
  created. INDEX.md is what gets skimmed each session — it must always be
  a true map of what's in `memory/`.
