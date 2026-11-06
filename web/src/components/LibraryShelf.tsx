import { useState } from "react";
import { IconArrowBackUp, IconFolder } from "@tabler/icons-react";
import type { ItemState, Library } from "@halolesson/shared";
import { TRASH_RETENTION_DAYS } from "@halolesson/shared";
import { daysUntilPurge, libraryApi, topEntries } from "$lib/library";
import { iconFor } from "$lib/subjectIcons";
import Button from "./Button";
import { folderColors, subjectColors } from "./SubjectNode";

// The archive and trash views: a flat list with a way back for each item.
// Trash has no delete button on purpose; items vanish on their own after 30 days.
export default function LibraryShelf({ library, view, onChanged }: { library: Library; view: Extract<ItemState, "archived" | "trashed">; onChanged: () => void }) {
  const entries = topEntries(library, view);
  const [error, setError] = useState("");

  async function bringBack(kind: "subject" | "folder", id: string) {
    setError("");
    try {
      await (view === "archived" ? libraryApi.archive(kind, id, false) : libraryApi.restore(kind, id));
      onChanged();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Something went wrong");
    }
  }

  return (
    <section aria-label={view === "archived" ? "Archive" : "Trash"} className="flex flex-col gap-3">
      <p className="rounded-xl bg-eel px-4 py-3 text-sm font-bold text-wolf">
        {view === "archived"
          ? "Archived subjects are hidden from your main page but nothing is lost. Unarchive them any time."
          : `Deleted items stay here for ${TRASH_RETENTION_DAYS} days, then they're gone for good. They can't be removed any sooner.`}
      </p>
      {error && <p role="alert" className="notice-error">{error}</p>}
      {entries.length === 0 && <p className="rounded-2xl border-2 border-dashed border-swan px-5 py-8 text-center font-bold text-wolf">{view === "archived" ? "Nothing archived." : "The trash is empty."}</p>}
      <ul className="flex flex-col gap-3">
        {entries.map((entry) => {
          const { color, dark } = entry.kind === "folder" ? folderColors(entry.item) : subjectColors(entry.item);
          const Symbol = entry.kind === "folder" ? IconFolder : iconFor(entry.item);
          const left = view === "trashed" && entry.item.deletedAt ? daysUntilPurge(entry.item.deletedAt) : null;
          return (
            <li key={entry.item.id} className="flex items-center gap-3 rounded-2xl border-2 border-swan bg-white p-3 shadow-[0_3px_0_#e5e5e5] sm:p-4">
              <span className="grid size-12 shrink-0 place-items-center rounded-2xl text-white opacity-80 shadow-[0_4px_0_var(--dark)]" style={{ background: color, ["--dark" as string]: dark }} aria-hidden="true"><Symbol size={26} stroke={2.4} /></span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-black">{entry.item.name}</p>
                <p className="text-xs font-extrabold uppercase tracking-wide text-wolf">
                  {entry.kind === "folder" ? "Folder" : "Subject"}{left !== null && ` · gone for good in ${left} ${left === 1 ? "day" : "days"}`}
                </p>
              </div>
              <Button variant="secondary" className="shrink-0 gap-2" onClick={() => void bringBack(entry.kind, entry.item.id)}>
                <IconArrowBackUp size={19} />{view === "archived" ? "Unarchive" : "Restore"}
              </Button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
