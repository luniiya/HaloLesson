import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { IconX } from "@tabler/icons-react";
import Button from "./Button";

interface ConfirmDialogProps {
  title: string;
  children: ReactNode;
  confirmLabel: string;
  danger?: boolean;
  // When set, the dialog asks for a value (e.g. a password) and passes it to onConfirm.
  input?: { label: string; type?: string; autoComplete?: string; placeholder?: string };
  onConfirm: (value: string) => Promise<void>;
  onClose: () => void;
}

export default function ConfirmDialog({ title, children, confirmLabel, danger = false, input, onConfirm, onClose }: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [value, setValue] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      await onConfirm(value);
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Something went wrong");
      setBusy(false);
    }
  }

  return (
    <dialog ref={dialogRef} className="agent-dialog max-w-md" onCancel={(event) => { event.preventDefault(); onClose(); }} onClick={(event) => { if (event.target === dialogRef.current) onClose(); }} aria-labelledby="confirm-dialog-title">
      <form className="agent-dialog-card" onSubmit={submit}>
        <button type="button" onClick={onClose} className="absolute right-4 top-3 rounded-lg p-2 text-wolf hover:bg-eel hover:text-ink" aria-label="Close dialog"><IconX size={22} /></button>
        <h2 id="confirm-dialog-title" className="pr-8 text-2xl font-black">{title}</h2>
        <div className="mt-2 text-sm font-semibold leading-6 text-wolf">{children}</div>
        {input && (
          <label className="form-label mt-5">{input.label}
            <input className="form-input" type={input.type ?? "text"} value={value} onChange={(event) => setValue(event.target.value)} autoComplete={input.autoComplete} placeholder={input.placeholder} required autoFocus />
          </label>
        )}
        {error && <p role="alert" className="notice-error mt-4">{error}</p>}
        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" variant={danger ? "danger" : "primary"} disabled={busy}>{busy ? "Please wait…" : confirmLabel}</Button>
        </div>
      </form>
    </dialog>
  );
}
