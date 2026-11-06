import { useEffect, useRef } from "react";
import type { LibraryEvent } from "@halolesson/shared";

const DEBOUNCE_MS = 150;

// Calls `onChange` when the signed-in user's library changes, e.g. while an
// agent is building. Bursts of commits are collapsed into one call; a null
// subjectId means "could be anything", so subject filters should accept it.
export function useLibraryEvents(onChange: (event: LibraryEvent) => void) {
  const callback = useRef(onChange);
  callback.current = onChange;

  useEffect(() => {
    const source = new EventSource("/api/events", { withCredentials: true });
    let timer: ReturnType<typeof setTimeout> | undefined;
    let pending: LibraryEvent | null = null;
    source.addEventListener("library", (message) => {
      const event = JSON.parse((message as MessageEvent<string>).data) as LibraryEvent;
      // Keep the widest scope seen during the burst.
      pending = pending && pending.subjectId !== event.subjectId ? { ...event, subjectId: null } : event;
      clearTimeout(timer);
      timer = setTimeout(() => {
        if (pending) callback.current(pending);
        pending = null;
      }, DEBOUNCE_MS);
    });
    return () => {
      clearTimeout(timer);
      source.close();
    };
  }, []);
}
