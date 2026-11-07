import { useEffect, useRef, useState, type DragEvent } from "react";
import { Link } from "react-router";
import { IconDownload, IconFileUpload } from "@tabler/icons-react";
import type { ExportStats, ImportPreview, ImportResult } from "@halolesson/shared";
import { api } from "$lib/api";
import { download } from "$lib/server";
import Button from "../../components/Button";
import ImportDialog from "../../components/ImportDialog";

function plural(count: number, word: string) {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}

export function ImportPanel({ onImported }: { onImported?: (result: ImportResult) => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [pasted, setPasted] = useState("");
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<ImportResult | null>(null);
  // A file that has been read and previewed, waiting for the user's choices.
  const [pending, setPending] = useState<{ file: Blob; preview: ImportPreview } | null>(null);

  async function previewFile(file: Blob | undefined) {
    if (!file) return;
    setError("");
    setResult(null);
    if (file.size > 10 * 1024 * 1024) return setError("Import files must be 10 MB or smaller");
    setBusy(true);
    try {
      const preview = await api<ImportPreview>("/api/import/preview", { method: "POST", body: file, headers: { "Content-Type": "application/octet-stream" } });
      setPending({ file, preview });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Couldn't read that file");
    } finally {
      setBusy(false);
    }
  }

  function previewText(raw: string) {
    try {
      JSON.parse(raw);
    } catch {
      setError("That isn't valid JSON. If an agent wrote it, make sure you copied the whole response.");
      return;
    }
    void previewFile(new Blob([raw], { type: "application/json" }));
  }

  function drop(event: DragEvent) {
    event.preventDefault();
    setDragging(false);
    void previewFile(event.dataTransfer.files[0]);
  }

  const updatedCount = result?.updated?.length ?? 0;
  const addedCount = (result?.subjects.length ?? 0) - updatedCount;

  return (
    <div className="flex flex-col gap-4">
      <button
        type="button"
        className={`drop-zone ${dragging ? "drop-zone-active" : ""}`}
        onClick={() => fileRef.current?.click()}
        onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={drop}
        disabled={busy}
      >
        <IconFileUpload size={32} className="text-secondary" aria-hidden="true" />
        <span className="font-extrabold text-ink">{busy ? "Reading…" : "Drop a .halolesson file or click to choose"}</span>
        <span className="text-xs font-semibold text-wolf">Backups, shared subjects, older .json exports, or agent JSON output</span>
      </button>
      <input ref={fileRef} type="file" accept=".halolesson,.zip,.json,application/json,application/zip" className="sr-only" tabIndex={-1} aria-hidden="true" onChange={(event) => { void previewFile(event.target.files?.[0]); event.target.value = ""; }} />
      <label className="form-label">Or paste JSON
        <textarea className="form-input min-h-32 resize-y font-mono text-xs leading-5" value={pasted} onChange={(event) => setPasted(event.target.value)} placeholder={'{ "subject": { "name": "…" }, "units": [ … ] }'} spellCheck={false} />
      </label>
      <div className="flex justify-end">
        <Button disabled={!pasted.trim() || busy} onClick={() => previewText(pasted)}>{busy ? "Reading…" : "Import pasted JSON"}</Button>
      </div>
      {error && <p role="alert" className="notice-error">{error}</p>}
      {pending && (
        <ImportDialog
          file={pending.file}
          preview={pending.preview}
          onClose={() => setPending(null)}
          onImported={(imported) => {
            setPending(null);
            setPasted("");
            setResult(imported);
            onImported?.(imported);
          }}
        />
      )}
      {result && (
        <div role="status" className="notice-success">
          {[addedCount && `Added ${plural(addedCount, "item")}`, updatedCount && `updated ${plural(updatedCount, "item")}`].filter(Boolean).join(", ").replace(/^u/, "U")}
          {` (${plural(result.skillCount, "skill")}, ${plural(result.exerciseCount, "exercise")}).`}
          <span className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
            {result.subjects.map((subject) => <Link key={subject.id} to={`/subjects/${subject.id}`} className="underline underline-offset-2">Open {subject.name}</Link>)}
          </span>
        </div>
      )}
    </div>
  );
}

export default function DataSettings() {
  const [stats, setStats] = useState<ExportStats | null>(null);

  function loadStats() {
    api<ExportStats>("/api/export/stats").then(setStats).catch(() => setStats(null));
  }
  useEffect(loadStats, []);

  return (
    <>
      <section className="settings-card">
        <h2 className="settings-card-title">Export a backup</h2>
        <p className="settings-card-hint">A .halolesson file with your whole account: every subject, tracker and folder, plus your progress, levels, notes and history. To share one subject without your personal data, use Share on its page instead.</p>
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {([["Subjects", stats?.subjectCount], ["Units", stats?.unitCount], ["Skills", stats?.skillCount], ["Exercises", stats?.exerciseCount]] as const).map(([label, value]) => (
            <div key={label} className="rounded-xl bg-eel px-4 py-3">
              <strong className="block text-2xl font-black text-ink">{value ?? "–"}</strong>
              <span className="text-xs font-extrabold uppercase tracking-wider text-wolf">{label}</span>
            </div>
          ))}
        </div>
        <div className="mt-5 flex justify-end">
          <Button className="gap-2" disabled={!stats?.subjectCount} onClick={() => download("/api/export")}><IconDownload size={19} />Download backup</Button>
        </div>
      </section>
      <section className="settings-card">
        <h2 className="settings-card-title">Import</h2>
        <p className="settings-card-hint">You see what’s inside before anything is imported. For items you already have, you choose: update yours, or add a copy.</p>
        <div className="mt-5"><ImportPanel onImported={loadStats} /></div>
      </section>
    </>
  );
}
