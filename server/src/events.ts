import type { LibraryEvent } from "@halolesson/shared";
import { db } from "./db";

type Listener = (event: LibraryEvent) => void;

const listeners = new Map<string, Set<Listener>>();
const encoder = new TextEncoder();
const PING_MS = 15_000;

export function libraryRevision(userId: string): number {
  return db.query<{ library_revision: number }, [string]>("SELECT library_revision FROM users WHERE id = ?").get(userId)?.library_revision ?? 0;
}

// Call inside the write's transaction so the revision and the data move together.
export function bumpRevision(userId: string, subjectId: string | null): number {
  if (subjectId) db.run("UPDATE subjects SET updated_at = ? WHERE id = ?", [new Date().toISOString(), subjectId]);
  return db
    .query<{ library_revision: number }, [string]>("UPDATE users SET library_revision = library_revision + 1 WHERE id = ? RETURNING library_revision")
    .get(userId)!.library_revision;
}

// Call after the transaction commits, so listeners never refetch stale data.
export function notifyLibrary(userId: string, event: LibraryEvent): void {
  for (const listener of listeners.get(userId) ?? []) listener(event);
}

export function libraryChanged(userId: string, subjectId: string | null): number {
  const revision = bumpRevision(userId, subjectId);
  notifyLibrary(userId, { revision, subjectId });
  return revision;
}

function subscribe(userId: string, listener: Listener): () => void {
  let set = listeners.get(userId);
  if (!set) listeners.set(userId, (set = new Set()));
  set.add(listener);
  return () => {
    set.delete(listener);
    if (set.size === 0) listeners.delete(userId);
  };
}

// Server-sent events for one signed-in user. The ping keeps proxies and Bun's
// idle timeout from closing a quiet stream.
export function eventStream(req: Request, userId: string): Response {
  let cleanup = () => {};
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (chunk: string) => {
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          cleanup();
        }
      };
      send(`event: ready\ndata: ${JSON.stringify({ revision: libraryRevision(userId) })}\n\n`);
      const unsubscribe = subscribe(userId, (event) => send(`event: library\ndata: ${JSON.stringify(event)}\n\n`));
      const ping = setInterval(() => send(": ping\n\n"), PING_MS);
      cleanup = () => {
        clearInterval(ping);
        unsubscribe();
      };
      req.signal.addEventListener("abort", () => {
        cleanup();
        try {
          controller.close();
        } catch {}
      });
    },
    cancel() {
      cleanup();
    },
  });
  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", "X-Accel-Buffering": "no" },
  });
}
