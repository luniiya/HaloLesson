// Read access to a downloaded Anki collection (schema 18) plus the few writes
// web reviews need (cards, revlog, note tags). Decks, presets and note types
// are protobuf blobs; templates and fields sit in WITHOUT ROWID tables that
// use Anki's "unicase" collation, which bun:sqlite can't load, so those two
// are read straight from the file (see sqliteFile.ts).
import { Database } from "bun:sqlite";
import { Message } from "./proto";
import { readWithoutRowidTable } from "./sqliteFile";
import { defaultDeckOptions, type CardRow, type DeckOptions, type RevlogRow, type Timing } from "./scheduler";

export interface DeckInfo {
  id: number;
  name: string; // "Parent::Child"
  filtered: boolean;
  configId: number | null;
  reviewLimit: number | null;
  newLimit: number | null;
  reviewLimitToday: { limit: number; today: number } | null;
  newLimitToday: { limit: number; today: number } | null;
  desiredRetention: number | null;
}

export interface TemplateInfo {
  ord: number;
  name: string;
  qfmt: string;
  afmt: string;
}

export interface NotetypeInfo {
  id: number;
  name: string;
  cloze: boolean;
  css: string;
  fields: string[];
  templates: TemplateInfo[];
}

export interface ColInfo {
  crt: number;
  mod: number;
  scm: number;
  usn: number;
  ls: number;
}

export class Collection {
  readonly db: Database;
  readonly path: string;
  private notetypeCache: Map<number, NotetypeInfo> | null = null;

  constructor(path: string, readonly = false) {
    this.path = path;
    this.db = readonly ? new Database(path, { readonly: true, strict: true }) : new Database(path, { readwrite: true, create: false, strict: true });
    this.db.run("PRAGMA busy_timeout = 5000");
  }

  close() {
    this.db.close(false);
  }

  // The mirror runs in rollback-journal mode so the raw template reader
  // always sees committed data in the main file.
  static prepare(path: string) {
    const db = new Database(path, { readwrite: true, create: false });
    try {
      const header = db.query<{ journal_mode: string }, []>("PRAGMA journal_mode = DELETE").get();
      if (header?.journal_mode?.toLowerCase() !== "delete") throw new Error("Could not prepare the Anki collection");
      const ver = db.query<{ ver: number }, []>("SELECT ver FROM col").get();
      if (!ver || ver.ver < 18) throw new Error(`Unsupported Anki collection version ${ver?.ver ?? "?"}`);
    } finally {
      db.close(false);
    }
  }

  col(): ColInfo {
    const row = this.db.query<ColInfo, []>("SELECT crt, mod, scm, usn, ls FROM col").get();
    if (!row) throw new Error("The Anki collection is empty");
    return row;
  }

  config<T>(key: string): T | undefined {
    const row = this.db.query<{ val: Uint8Array | string }, [string]>("SELECT val FROM config WHERE KEY = ?").get(key);
    if (!row) return undefined;
    try {
      return JSON.parse(typeof row.val === "string" ? row.val : new TextDecoder().decode(row.val)) as T;
    } catch {
      return undefined;
    }
  }

  fsrsEnabled() {
    return this.config<boolean>("fsrs") === true;
  }

  fsrsShortTermWithSteps() {
    return this.config<boolean>("fsrsShortTermWithStepsEnabled") === true;
  }

  // Seconds to look ahead for learning cards (Anki's "learn ahead limit").
  learnAheadSecs() {
    const value = this.config<number>("collapseTime");
    return typeof value === "number" ? value : 1200;
  }

  decks(): DeckInfo[] {
    // Selecting by rowid only: the name index uses the unicase collation.
    const rows = this.db.query<{ id: number; name: string; kind: Uint8Array }, []>("SELECT id, name, kind FROM decks").all();
    return rows.map((row) => {
      const kind = new Message(row.kind);
      const normal = kind.message(1);
      const dayLimit = (message: Message | null) => (message ? { limit: message.uint(1), today: message.uint(2) } : null);
      return {
        id: row.id,
        name: row.name.split("\x1f").join("::"),
        filtered: !normal,
        configId: normal ? normal.int(1) || 1 : null,
        reviewLimit: normal?.has(6) ? normal.uint(6) : null,
        newLimit: normal?.has(7) ? normal.uint(7) : null,
        reviewLimitToday: dayLimit(normal?.message(8) ?? null),
        newLimitToday: dayLimit(normal?.message(9) ?? null),
        desiredRetention: normal?.has(10) ? normal.float(10) : null,
      };
    });
  }

  deckOptions(configId: number): DeckOptions {
    const row =
      this.db.query<{ config: Uint8Array }, [number]>("SELECT config FROM deck_config WHERE id = ?").get(configId) ??
      this.db.query<{ config: Uint8Array }, [number]>("SELECT config FROM deck_config WHERE id = ?").get(1);
    const options = defaultDeckOptions();
    if (!row) return options;
    const c = new Message(row.config);
    const params6 = c.floats(6);
    const params5 = c.floats(5);
    return {
      learnSteps: c.floats(1),
      relearnSteps: c.floats(2),
      graduatingIntervalGood: c.uint(18),
      graduatingIntervalEasy: c.uint(19),
      initialEase: c.float(11),
      easyMultiplier: c.float(12),
      hardMultiplier: c.float(13),
      lapseMultiplier: c.float(14),
      intervalMultiplier: c.float(15),
      maximumReviewInterval: c.uint(16),
      minimumLapseInterval: c.uint(17),
      leechThreshold: c.uint(22),
      leechSuspend: c.uint(21) === 0,
      capAnswerTimeSecs: c.uint(24),
      newPerDay: c.uint(9),
      reviewsPerDay: c.uint(10),
      buryNew: c.bool(27),
      buryReviews: c.bool(28),
      buryInterdayLearning: c.bool(29),
      fsrsParams: params6.length ? params6 : params5.length ? params5 : c.floats(3),
      desiredRetention: c.has(37) ? c.float(37) : 0.9,
    };
  }

  notetypes(): Map<number, NotetypeInfo> {
    if (this.notetypeCache) return this.notetypeCache;
    const roots = new Map(
      this.db
        .query<{ name: string; rootpage: number }, []>("SELECT name, rootpage FROM sqlite_master WHERE type = 'table' AND name IN ('templates', 'fields')")
        .all()
        .map((row) => [row.name, row.rootpage]),
    );
    const templateRoot = roots.get("templates");
    const fieldRoot = roots.get("fields");
    if (!templateRoot || !fieldRoot) throw new Error("The Anki collection has no note types");
    const types = new Map<number, NotetypeInfo>();
    for (const row of this.db.query<{ id: number; name: string; config: Uint8Array }, []>("SELECT id, name, config FROM notetypes").all()) {
      const config = new Message(row.config);
      types.set(row.id, { id: row.id, name: row.name, cloze: config.uint(1) === 1, css: config.string(3), fields: [], templates: [] });
    }
    // templates: ntid, ord, name, mtime_secs, usn, config
    for (const [ntid, ord, name, , , config] of readWithoutRowidTable(this.path, templateRoot)) {
      const type = types.get(Number(ntid));
      if (!type) continue;
      const message = new Message(config instanceof Uint8Array ? config : null);
      type.templates.push({ ord: Number(ord), name: String(name), qfmt: message.string(1), afmt: message.string(2) });
    }
    // fields: ntid, ord, name, config
    const fieldLists = new Map<number, Array<[number, string]>>();
    for (const [ntid, ord, name] of readWithoutRowidTable(this.path, fieldRoot)) {
      const list = fieldLists.get(Number(ntid)) ?? [];
      list.push([Number(ord), String(name)]);
      fieldLists.set(Number(ntid), list);
    }
    for (const [ntid, list] of fieldLists) {
      const type = types.get(ntid);
      if (type) type.fields = list.sort((a, b) => a[0] - b[0]).map(([, name]) => name);
    }
    for (const type of types.values()) type.templates.sort((a, b) => a.ord - b.ord);
    this.notetypeCache = types;
    return types;
  }

  // Anki's sched_timing_today. minutesWest is the viewer's UTC offset
  // (Date#getTimezoneOffset), used when the collection has no localOffset.
  timing(nowSecs: number, minutesWest: number): Timing {
    const crt = this.col().crt;
    const rollover = this.config<number>("rollover") ?? 4;
    const creationOffset = this.config<number>("creationOffset");
    const localOffset = this.config<number>("localOffset");
    return schedTiming(crt, nowSecs, creationOffset ?? null, localOffset ?? minutesWest, rollover);
  }

  card(id: number): CardRow | null {
    return this.db.query<CardRow, [number]>("SELECT * FROM cards WHERE id = ?").get(id);
  }

  lastReviewSecs(cardId: number): number | null {
    const row = this.db.query<{ id: number | null }, [number]>("SELECT max(id) AS id FROM revlog WHERE cid = ? AND ease BETWEEN 1 AND 4").get(cardId);
    return row?.id ? Math.floor(row.id / 1000) : null;
  }

  note(id: number) {
    return this.db.query<{ id: number; mid: number; tags: string; flds: string; mod: number; usn: number }, [number]>("SELECT id, mid, tags, flds, mod, usn FROM notes WHERE id = ?").get(id);
  }

  // Saves an answered card. Revlog ids must be unique; bump on collision.
  saveAnswer(card: CardRow, revlog: RevlogRow, leechTagNote: number | null, nowSecs: number) {
    this.db.transaction(() => {
      let id = revlog.id;
      while (this.db.query("SELECT 1 FROM revlog WHERE id = ?").get(id)) id++;
      this.db.run("INSERT INTO revlog (id, cid, usn, ease, ivl, lastIvl, factor, time, type) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)", [
        id, revlog.cid, revlog.usn, revlog.ease, revlog.ivl, revlog.lastIvl, revlog.factor, revlog.time, revlog.type,
      ]);
      const changed = this.db.run(
        `UPDATE cards SET type = ?, queue = ?, due = ?, ivl = ?, factor = ?, reps = ?, lapses = ?, left = ?, mod = ?, usn = ?, data = ? WHERE id = ?`,
        [card.type, card.queue, card.due, card.ivl, card.factor, card.reps, card.lapses, card.left, card.mod, card.usn, card.data, card.id],
      );
      if (changed.changes !== 1) throw new Error("Card not found");
      if (leechTagNote !== null) {
        const note = this.note(leechTagNote);
        if (note && !note.tags.split(" ").some((tag) => tag.toLowerCase() === "leech")) {
          const tags = ` ${[...note.tags.split(" ").filter(Boolean), "leech"].join(" ")} `;
          this.db.run("UPDATE notes SET tags = ?, mod = ?, usn = -1 WHERE id = ?", [tags, nowSecs, note.id]);
        }
      }
    })();
  }

  pendingCounts() {
    const count = (table: string) => this.db.query<{ n: number }, []>(`SELECT count(*) AS n FROM ${table} WHERE usn = -1`).get()!.n;
    return { cards: count("cards"), notes: count("notes"), revlog: count("revlog") };
  }
}

// ---------- timing (scheduler/timing.rs) ----------

function daysFromCe(secs: number, minutesWest: number) {
  return Math.floor((secs - minutesWest * 60) / 86_400);
}

const boundedWest = (minutes: number) => Math.max(-23 * 60, Math.min(23 * 60, Math.trunc(minutes)));

// Unix seconds of today's rollover hour in the given offset.
function rolloverAt(secs: number, minutesWest: number, hour: number) {
  const localDayStart = daysFromCe(secs, minutesWest) * 86_400; // local midnight as if UTC
  return localDayStart + (hour % 24) * 3600 + minutesWest * 60;
}

export function schedTiming(crt: number, now: number, creationWest: number | null, currentWest: number, rollover: number): Timing {
  const current = boundedWest(currentWest);
  if (creationWest === null) {
    // v2 legacy
    const crtAtRollover = rolloverAt(crt, current, rollover);
    const daysElapsed = Math.max(Math.trunc((now - crtAtRollover) / 86_400), 0);
    let nextDayAt = rolloverAt(now, current, rollover);
    if (nextDayAt < now) nextDayAt += 86_400;
    return { now, daysElapsed, nextDayAt };
  }
  const creation = boundedWest(creationWest);
  const rolloverToday = rolloverAt(now, current, rollover);
  const passed = rolloverToday <= now;
  const nextDayAt = passed ? rolloverToday + 86_400 : rolloverToday;
  let days = daysFromCe(now, current) - daysFromCe(crt, creation);
  if (!passed) days -= 1;
  return { now, daysElapsed: Math.max(days, 0), nextDayAt };
}
