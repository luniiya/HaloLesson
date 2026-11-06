import { useCallback, useEffect, useState } from "react";
import type { Library } from "@halolesson/shared";
import { useLibraryEvents } from "$lib/events";
import { libraryApi } from "$lib/library";
import LibraryShelf from "../components/LibraryShelf";

// /archive and /trash, linked from the sidebar.
export default function ShelfPage({ view }: { view: "archived" | "trashed" }) {
  const [library, setLibrary] = useState<Library | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    libraryApi.get().then(setLibrary).catch((cause) => setError(cause instanceof Error ? cause.message : "Could not load your library"));
  }, []);
  useEffect(load, [load]);
  useLibraryEvents(() => libraryApi.get().then(setLibrary).catch(() => {}));

  return (
    <div className="mx-auto flex min-h-dvh max-w-4xl flex-col px-5 pb-28 pt-8 sm:px-8 md:pb-8 md:pt-10 lg:px-10">
      <h1 className="mb-8 text-[2rem] font-black leading-tight tracking-tight sm:text-4xl">{view === "archived" ? "Archive" : "Trash"}</h1>
      {error && <p role="alert" className="notice-error">{error}</p>}
      {!library && !error && <div className="h-24 animate-pulse rounded-2xl bg-eel" aria-label="Loading" />}
      {library && <LibraryShelf library={library} view={view} onChanged={load} />}
    </div>
  );
}
