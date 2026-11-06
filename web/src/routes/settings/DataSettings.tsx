import { useEffect, useRef, useState, type DragEvent } from "react";
import { Link } from "react-router";
import { IconDownload, IconFileUpload } from "@tabler/icons-react";
import type { ExportStats, ImportResult } from "@halolesson/shared";
import { api } from "$lib/api";
import { download } from "$lib/server";
import Button from "../../components/Button";

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

  async function importText(raw: string) {
    setError("");
    setResult(null);
    try {
      JSON.parse(raw);
    } catch {
      setError("That isn't valid JSON. If an agent wrote it, make sure you copied the whole response.");
      return;
    }
    setBusy(true);
    try {
      const imported = await api<ImportResult>("/api/import", { method: "POST", body: raw });
      setResult(imported);
      setPasted("");
      onImported?.(imported);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Import failed");
    } finally {
      setBusy(false);
    }
  }

  async function importFile(file: File | undefined) {
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) return setError("Import files must be 10 MB or smaller");
    await importText(await file.text());
  }

  function drop(event: DragEvent) {
    event.preventDefault();
    setDragging(false);
    void importFile(event.dataTransfer.files[0]);
  }

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
        <span className="font-extrabold text-ink">{busy ? "Importing…" : "Drop a .json file or click to choose"}</span>
        <span className="text-xs font-semibold text-wolf">haloLesson backups, shared subjects, or agent JSON output</span>
      </button>
      <input ref={fileRef} type="file" accept="application/json,.json" className="sr-only" tabIndex={-1} aria-hidden="true" onChange={(event) => { void importFile(event.target.files?.[0]); event.target.value = ""; }} />
      <label className="form-label">Or paste JSON
        <textarea className="form-input min-h-32 resize-y font-mono text-xs leading-5" value={pasted} onChange={(event) => setPasted(event.target.value)} placeholder={'{ "subject": { "name": "…" }, "units": [ … ] }'} spellCheck={false} />
      </label>
      <div className="flex justify-end">
        <Button disabled={!pasted.trim() || busy} onClick={() => void importText(pasted)}>{busy ? "Importing…" : "Import pasted JSON"}</Button>
      </div>
      {error && <p role="alert" className="notice-error">{error}</p>}
      {result && (
        <div role="status" className="notice-success">
          Imported {plural(result.subjects.length, "subject")}, {plural(result.skillCount, "skill")} and {plural(result.exerciseCount, "exercise")}.
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
        <p className="settings-card-hint">One JSON file with every subject, unit, skill and exercise, plus your mastery. To share a single subject, use Share on its page instead.</p>
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
        <p className="settings-card-hint">Imports always add new subjects. Nothing you already have is changed or replaced.</p>
        <div className="mt-5"><ImportPanel onImported={loadStats} /></div>
      </section>
    </>
  );
}
