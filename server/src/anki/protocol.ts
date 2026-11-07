// Anki sync protocol v11 client (the protocol Anki desktop, AnkiDroid and
// AnkiWeb speak). Every call is a POST to <endpoint>/sync/<method> with a
// zstd-compressed JSON body and an "anki-sync" header; responses are zstd too.
// Errors come back as a non-2xx status with a plain-text reason.
// Reference: rslib/src/sync in the Anki source (26.09).

export const ANKIWEB_ENDPOINT = "https://sync.ankiweb.net/";
export const SYNC_VERSION = 11;
// What Anki itself sends ("<version>,<buildhash>,<os>" and "anki,<version> (<hash>),<os>").
const CLIENT_SHORT = "26.09.4,halolesson,linux";
const CLIENT_LONG = "anki,26.09.4 (halolesson),linux";

export type Fetcher = (input: string, init: RequestInit) => Promise<Response>;

export class AnkiSyncError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export interface SyncMeta {
  mod: number;
  scm: number;
  usn: number;
  ts: number;
  msg: string;
  cont: boolean;
  empty: boolean;
}

export interface Graves {
  cards: number[];
  notes: number[];
  decks: number[];
}

// Rows in the order Anki's chunk tuples use.
export type RevlogTuple = [id: number, cid: number, usn: number, ease: number, ivl: number, lastIvl: number, factor: number, time: number, type: number];
export type CardTuple = [
  id: number, nid: number, did: number, ord: number, mod: number, usn: number, type: number, queue: number, due: number,
  ivl: number, factor: number, reps: number, lapses: number, left: number, odue: number, odid: number, flags: number, data: string,
];
export type NoteTuple = [id: number, guid: string, mid: number, mod: number, usn: number, tags: string, flds: string, sfld: string, csum: string, flags: number, data: string];

export interface Chunk {
  done: boolean;
  revlog?: RevlogTuple[];
  cards?: CardTuple[];
  notes?: NoteTuple[];
}

export interface UnchunkedChanges {
  models?: Array<{ id: number | string }>;
  decks?: [Array<{ id: number | string }>, Array<{ id: number | string }>];
  tags?: string[];
}

export interface SanityCounts {
  counts: [number, number, number];
  cards: number;
  notes: number;
  revlog: number;
  graves: number;
  models: number;
  decks: number;
  deckConfig: number;
}

// Normalises what the user typed into a sync endpoint URL ending in a slash.
export function normaliseEndpoint(input: string | null | undefined): string {
  const raw = (input ?? "").trim();
  if (!raw) return ANKIWEB_ENDPOINT;
  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
  } catch {
    throw new Error("Server address must be a valid URL");
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error("Server address must start with http:// or https://");
  if (url.username || url.password) throw new Error("Put your username and password in their own fields, not in the address");
  url.search = "";
  url.hash = "";
  // People paste the full sync URL; the client adds sync/<method> itself.
  url.pathname = url.pathname.replace(/\/sync\/?$/, "/");
  if (!url.pathname.endsWith("/")) url.pathname += "/";
  return url.toString();
}

export class SyncClient {
  endpoint: string;
  hostKey: string;
  readonly sessionKey = crypto.randomUUID().replace(/-/g, "").slice(0, 8);
  private fetcher: Fetcher;
  private timeoutMs: number;

  constructor(endpoint: string, hostKey = "", fetcher: Fetcher = fetch, timeoutMs = 120_000) {
    this.endpoint = endpoint;
    this.hostKey = hostKey;
    this.fetcher = fetcher;
    this.timeoutMs = timeoutMs;
  }

  // Raw call: returns the decompressed body. Follows AnkiWeb's 308 shard
  // redirect once, keeping the new endpoint (callers persist it).
  async raw(method: string, payload: unknown, redirects = 1): Promise<Uint8Array> {
    const response = await this.fetcher(new URL(`sync/${method}`, this.endpoint).toString(), {
      method: "POST",
      redirect: "manual",
      headers: {
        "anki-sync": JSON.stringify({ v: SYNC_VERSION, k: this.hostKey, c: CLIENT_SHORT, s: this.sessionKey }),
        "content-type": "application/octet-stream",
      },
      body: Bun.zstdCompressSync(new TextEncoder().encode(JSON.stringify(payload))),
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    if (response.status === 308 && redirects > 0) {
      const location = response.headers.get("location");
      if (!location) throw new AnkiSyncError("The sync server redirected without a location", 308);
      this.endpoint = normaliseEndpoint(new URL(location, this.endpoint).toString().replace(/sync\/[^/]*$/, ""));
      return this.raw(method, payload, redirects - 1);
    }
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (!response.ok) {
      const text = new TextDecoder().decode(bytes).slice(0, 300).trim();
      throw new AnkiSyncError(errorMessage(response.status, text), response.status);
    }
    if (bytes.length === 0) return bytes;
    return Bun.zstdDecompressSync(bytes);
  }

  async json<T>(method: string, payload: unknown): Promise<T> {
    const bytes = await this.raw(method, payload);
    return JSON.parse(new TextDecoder().decode(bytes)) as T;
  }

  // Trades a username and password for a host key. The password is not kept.
  async login(username: string, password: string): Promise<string> {
    const saved = this.hostKey;
    this.hostKey = "";
    try {
      const { key } = await this.json<{ key: string }>("hostKey", { u: username, p: password });
      if (typeof key !== "string" || !key) throw new AnkiSyncError("The sync server did not return a key", 500);
      this.hostKey = key;
      return key;
    } catch (error) {
      this.hostKey = saved;
      throw error;
    }
  }

  meta() {
    return this.json<SyncMeta>("meta", { v: SYNC_VERSION, cv: CLIENT_LONG });
  }

  // The whole collection as a SQLite file. Read-only on the server's side
  // (it only bumps its update counter).
  download() {
    return this.raw("download", {});
  }

  start(minUsn: number, localIsNewer: boolean) {
    return this.json<Graves>("start", { minUsn, lnewer: localIsNewer });
  }

  applyGraves(chunk: Graves) {
    return this.json<unknown>("applyGraves", { chunk });
  }

  applyChanges(changes: UnchunkedChanges) {
    return this.json<UnchunkedChanges>("applyChanges", { changes });
  }

  chunk() {
    return this.json<Chunk>("chunk", {});
  }

  applyChunk(chunk: Chunk) {
    return this.json<unknown>("applyChunk", { chunk });
  }

  sanityCheck(counts: SanityCounts) {
    const client = [counts.counts, counts.cards, counts.notes, counts.revlog, counts.graves, counts.models, counts.decks, counts.deckConfig];
    return this.json<{ status: "ok" | "bad"; c?: unknown; s?: unknown }>("sanityCheck2", { client });
  }

  finish() {
    return this.json<number>("finish", {});
  }

  async abort() {
    try {
      await this.raw("abort", {});
    } catch {
      // Best effort: the server also drops a stale transaction on the next start.
    }
  }
}

function errorMessage(status: number, text: string) {
  if (status === 403) return "Anki rejected the username or password";
  if (status === 401) return "Anki no longer accepts this login. Link your account again";
  if (status === 409) return "Anki is busy with another sync for this account. Try again in a minute";
  if (status === 413) return "The collection is too large for the sync server";
  if (status === 501) return "This sync server is too old for this client";
  return text ? `Anki sync failed (${status}): ${text}` : `Anki sync failed (${status})`;
}
