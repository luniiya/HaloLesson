import { useEffect, useRef, useState } from "react";
import { MAX_NOTES_LENGTH, type Subject } from "@halolesson/shared";
import { libraryApi } from "$lib/library";
import { iconFor } from "$lib/subjectIcons";
import { subjectColors } from "./SubjectNode";

// Saving waits for the user to settle, since dragging and typing fire many changes.
const NOTES_SAVE_DELAY_MS = 800;

// Debounced save of one subject field. Edits from elsewhere (an agent, another
// tab) replace the local value only while nothing is waiting to be saved.
function useAutosave<T>(remote: T, save: (value: T) => Promise<unknown>, delay: number) {
  const [value, setValue] = useState(remote);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  // Local edits not yet saved; a save only clears this if nothing newer came in.
  const pending = useRef(0);

  useEffect(() => { if (!pending.current) setValue(remote); }, [remote]);
  useEffect(() => () => clearTimeout(timer.current), []);

  function change(next: T) {
    setValue(next);
    const edit = ++pending.current;
    setStatus("saving");
    clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      try {
        await save(next);
        if (edit === pending.current) setStatus("saved");
      } catch {
        setStatus("error");
      }
      if (edit === pending.current) pending.current = 0;
    }, delay);
  }
  return { value, change, status };
}

function SaveStatus({ status }: { status: "idle" | "saving" | "saved" | "error" }) {
  if (status === "idle") return null;
  if (status === "error") return <span role="alert" className="text-xs font-extrabold text-cardinal">Couldn’t save</span>;
  return <span className="text-xs font-extrabold uppercase tracking-wider text-hare" role="status">{status === "saving" ? "Saving…" : "Saved"}</span>;
}

function NotesCard({ subject }: { subject: Subject }) {
  const notes = useAutosave(subject.notes, (next) => libraryApi.updateSubject(subject.id, { notes: next }), NOTES_SAVE_DELAY_MS);
  return (
    <section className="settings-card flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="settings-card-title">Notes</h2>
          <p className="settings-card-hint">What you’re working on, what clicked, what to try next.</p>
        </div>
        <SaveStatus status={notes.status} />
      </div>
      <textarea
        className="form-input min-h-56 resize-y leading-7"
        value={notes.value}
        onChange={(event) => notes.change(event.target.value)}
        maxLength={MAX_NOTES_LENGTH}
        placeholder="e.g. Can play G, C and D cleanly. Next: the F barre chord."
        aria-label="Notes"
      />
    </section>
  );
}

// A tracker's page: no skill path, just its circle and notes. The level is set
// from Edit mode on the main page.
export default function TrackerView({ subject }: { subject: Subject }) {
  const Symbol = iconFor(subject);
  const { color, dark } = subjectColors(subject);
  return (
    <div className="mt-8 flex flex-col gap-5">
      <div className="flex items-center gap-4">
        <span className="grid size-16 shrink-0 place-items-center rounded-full text-white" style={{ background: color, boxShadow: `0 5px 0 ${dark}` }} aria-hidden="true">
          <Symbol size={32} stroke={2.4} />
        </span>
        <p className="text-sm font-semibold leading-6 text-wolf">You’re learning this outside haloLesson. Jot down where you’re at and what’s next.</p>
      </div>
      <NotesCard subject={subject} />
    </div>
  );
}
