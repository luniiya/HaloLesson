import { useEffect, useRef, useState } from "react";
import { IconX } from "@tabler/icons-react";
import { libraryStates, type ImportChoice, type ImportPreview, type ImportResult, type Library } from "@halolesson/shared";
import { api } from "$lib/api";
import { libraryApi } from "$lib/library";
import { iconFor } from "$lib/subjectIcons";
import Button from "./Button";
import { subjectColors } from "./SubjectNode";

function plural(count: number, word: string) {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}

// Every active folder as a breadcrumb label, parents before children.
function folderOptions(library: Library) {
  const states = libraryStates(library);
  const byId = new Map(library.folders.map((folder) => [folder.id, folder]));
  const path = (id: string): string[] => {
    const folder = byId.get(id)!;
    return folder.parentId ? [...path(folder.parentId), folder.name] : [folder.name];
  };
  return library.folders
    .filter((folder) => states.get(folder.id) === "active")
    .map((folder) => ({ id: folder.id, label: path(folder.id).join(" / ") }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

// Import step two: what's in the file, which items to bring in, whether to
// update the copies you already have, and where new items land.
export default function ImportDialog({ file, preview, onImported, onClose }: {
  file: Blob;
  preview: ImportPreview;
  onImported: (result: ImportResult) => void;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [choices, setChoices] = useState<ImportChoice[]>(() => preview.items.map((item) => (item.match ? "update" : "add")));
  const [folders, setFolders] = useState<Array<{ id: string; label: string }>>([]);
  const [folderId, setFolderId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const dialog = dialogRef.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);
  useEffect(() => { libraryApi.get().then((library) => setFolders(folderOptions(library))).catch(() => {}); }, []);

  const picked = choices.filter((choice) => choice !== "skip").length;
  const adding = preview.items.some((item, index) => choices[index] === "add");
  const setChoice = (index: number, choice: ImportChoice) => setChoices((current) => current.map((value, at) => (at === index ? choice : value)));
  const setAll = (include: boolean) => setChoices(preview.items.map((item) => (include ? (item.match ? "update" : "add") : "skip")));

  async function confirm() {
    setError("");
    setBusy(true);
    try {
      const options = encodeURIComponent(JSON.stringify({ choices, folderId: folderId || null }));
      const result = await api<ImportResult>(`/api/import?options=${options}`, { method: "POST", body: file, headers: { "Content-Type": "application/octet-stream" } });
      onImported(result);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Import failed");
      setBusy(false);
    }
  }

  return (
    <dialog ref={dialogRef} className="agent-dialog max-w-2xl" onCancel={(event) => { event.preventDefault(); onClose(); }} onClick={(event) => { if (event.target === dialogRef.current) onClose(); }} aria-labelledby="import-dialog-title">
      <div className="agent-dialog-card">
        <button type="button" onClick={onClose} className="absolute right-4 top-3 rounded-lg p-2 text-wolf hover:bg-eel hover:text-ink" aria-label="Close dialog"><IconX size={22} /></button>
        <p className="text-xs font-black uppercase tracking-[0.16em] text-secondary">{preview.kind === "backup" ? "Backup" : "Shared file"}</p>
        <h2 id="import-dialog-title" className="mt-1 pr-8 text-2xl font-black">Import {plural(preview.items.length, "item")}</h2>
        <p className="mt-1 text-sm font-semibold leading-6 text-wolf">
          {preview.exportedAt ? `Exported ${new Date(preview.exportedAt).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })}. ` : ""}
          Pick what to bring in. For things you already have, choose whether to update yours or add a second copy.
        </p>

        {preview.items.length > 1 && (
          <div className="mt-4 flex gap-3 text-xs font-extrabold">
            <button type="button" className="text-secondary hover:underline" onClick={() => setAll(true)}>Select all</button>
            <button type="button" className="text-wolf hover:underline" onClick={() => setAll(false)}>Select none</button>
          </div>
        )}
        <ul className="mt-3 flex max-h-[45vh] flex-col gap-2 overflow-y-auto pr-1">
          {preview.items.map((item, index) => {
            const Symbol = iconFor(item);
            const { color, dark } = subjectColors(item);
            const choice = choices[index]!;
            const included = choice !== "skip";
            return (
              <li key={index} className={`rounded-2xl border-2 p-3 transition-colors ${included ? "border-swan" : "border-swan/60 opacity-60"}`}>
                <label className="flex cursor-pointer items-center gap-3">
                  <input type="checkbox" className="size-5 shrink-0 accent-[var(--color-secondary)]" checked={included} onChange={(event) => setChoice(index, event.target.checked ? (item.match ? "update" : "add") : "skip")} />
                  <span className="grid size-9 shrink-0 place-items-center rounded-full text-white" style={{ background: color, boxShadow: `0 3px 0 ${dark}` }} aria-hidden="true"><Symbol size={19} stroke={2.4} /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-extrabold">{item.name}</span>
                    <span className="block truncate text-xs font-bold text-wolf">
                      {[item.type === "tracker" ? "Tracker" : `${plural(item.skillCount, "skill")} · ${plural(item.exerciseCount, "exercise")}`, item.folderPath.join(" / ")].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                </label>
                {item.match && included && (
                  <div className="mt-3 flex flex-col gap-2 rounded-xl bg-eel p-2.5 sm:flex-row sm:items-center sm:justify-between">
                    <span className="text-xs font-bold text-wolf">You already have <b className="text-ink">{item.match.name}</b></span>
                    <div className="stats-switch shrink-0 self-start bg-surface sm:self-auto" role="group" aria-label={`What to do with ${item.name}`}>
                      <button type="button" aria-pressed={choice === "update"} onClick={() => setChoice(index, "update")}>Update mine</button>
                      <button type="button" aria-pressed={choice === "add"} onClick={() => setChoice(index, "add")}>Add a copy</button>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
        {choices.includes("update") && <p className="mt-3 text-xs font-semibold leading-5 text-wolf">Updating replaces the lessons with the file's version. Your progress on everything that's still there stays.</p>}

        {adding && folders.length > 0 && (
          <label className="form-label mt-4">New items go into
            <select className="form-input py-2.5" value={folderId} onChange={(event) => setFolderId(event.target.value)}>
              <option value="">Top of your library</option>
              {folders.map((folder) => <option key={folder.id} value={folder.id}>{folder.label}</option>)}
            </select>
          </label>
        )}
        {error && <p role="alert" className="notice-error mt-4">{error}</p>}
        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button disabled={busy || picked === 0} onClick={() => void confirm()}>{busy ? "Importing…" : picked === 0 ? "Pick something" : `Import ${plural(picked, "item")}`}</Button>
        </div>
      </div>
    </dialog>
  );
}
