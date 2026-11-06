import { useEffect, useRef, useState, type FormEvent } from "react";
import { IconX } from "@tabler/icons-react";
import type { Subject } from "@halolesson/shared";
import { libraryApi } from "$lib/library";
import Button from "./Button";
import LevelSlider from "./LevelSlider";

// Edit mode's level popup: rate yourself on a subject or tracker.
export default function LevelDialog({ subject, onChanged, onClose }: { subject: Subject; onChanged: () => void; onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [level, setLevel] = useState(subject.level);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);

  async function save(event: FormEvent) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      await libraryApi.updateSubject(subject.id, { level });
      onChanged();
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save your level");
      setBusy(false);
    }
  }

  return (
    <dialog ref={dialogRef} className="agent-dialog max-w-lg" onCancel={(event) => { event.preventDefault(); onClose(); }} onClick={(event) => { if (event.target === dialogRef.current) onClose(); }} aria-labelledby="level-dialog-title">
      <form className="agent-dialog-card" onSubmit={save}>
        <button type="button" onClick={onClose} className="absolute right-4 top-3 rounded-lg p-2 text-wolf hover:bg-eel hover:text-ink" aria-label="Close dialog"><IconX size={22} /></button>
        <h2 id="level-dialog-title" className="truncate pr-8 text-2xl font-black">How good are you at {subject.name}?</h2>
        <p className="mt-1 text-sm font-semibold leading-6 text-wolf">Rate yourself honestly. Only you see it, and you can change it any time.</p>
        <div className="mt-6"><LevelSlider value={level} onChange={setLevel} /></div>
        {error && <p role="alert" className="notice-error mt-4">{error}</p>}
        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          {subject.level !== null && <Button variant="ghost" className="sm:mr-auto" onClick={() => setLevel(null)}>Clear rating</Button>}
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={busy}>{busy ? "Saving…" : "Save"}</Button>
        </div>
      </form>
    </dialog>
  );
}
