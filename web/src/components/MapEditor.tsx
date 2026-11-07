import { useEffect, useState, type FormEvent } from "react";
import { IconLink, IconPlus, IconTrash, IconX } from "@tabler/icons-react";
import type { Skill, SubjectDetail } from "@halolesson/shared";
import { api } from "$lib/api";
import Button from "./Button";
import { regionColors } from "./SkillMap";
import UnlockInOrderToggle from "./UnlockInOrderToggle";

type MapWrite = { id?: string; detail: SubjectDetail };

// Every map change returns the updated map, with its new layout.
function write(path: string, method: string, body?: object) {
  return api<MapWrite>(path, { method, body: body ? JSON.stringify(body) : undefined });
}

// Edit mode beside the map: add skills and regions, rename, move between
// regions, mark start skills, link and delete. Writing exercises stays with agents.
export default function MapEditor({ detail, selected, linkMode, onDetail, onSelect, onLinkMode }: {
  detail: SubjectDetail;
  selected: Skill | null;
  linkMode: boolean;
  onDetail: (detail: SubjectDetail) => void;
  onSelect: (skillId: string | null) => void;
  onLinkMode: (on: boolean) => void;
}) {
  const [error, setError] = useState("");
  const [adding, setAdding] = useState(false);
  const busy = useBusy();

  async function run(path: string, method: string, body?: object) {
    setError("");
    try {
      const result = await busy.wrap(write(path, method, body));
      onDetail(result.detail);
      return result;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "That didn't work");
      return null;
    }
  }

  const subjectId = detail.subject.id;
  return (
    <aside className="flex flex-col gap-4" aria-label="Edit map">
      <div className="map-panel">
        <div className="flex flex-wrap gap-2">
          <Button className="flex-1 gap-2" onClick={() => setAdding(true)}><IconPlus size={18} />Add skill</Button>
          <Button variant="secondary" className="flex-1 gap-2" onClick={() => void run(`/api/subjects/${subjectId}/regions`, "POST", { title: `Region ${detail.units.length + 1}` })}><IconPlus size={18} />Add region</Button>
        </div>
        <UnlockInOrderToggle
          checked={detail.subject.unlockInOrder}
          disabled={busy.on}
          onChange={(unlockInOrder) => {
            setError("");
            busy.wrap(api(`/api/subjects/${subjectId}`, { method: "PATCH", body: JSON.stringify({ unlockInOrder }) }))
              .then(() => api<SubjectDetail>(`/api/subjects/${subjectId}`))
              .then(onDetail)
              .catch((cause) => setError(cause instanceof Error ? cause.message : "That didn't work"));
          }}
        />
        {error && <p role="alert" className="notice-error">{error}</p>}
      </div>

      {adding && (
        <NewSkill
          detail={detail}
          near={selected}
          onCancel={() => setAdding(false)}
          onCreate={async (fields) => {
            const result = await run(`/api/subjects/${subjectId}/skills`, "POST", fields);
            if (result?.id) {
              setAdding(false);
              onSelect(result.id);
            }
          }}
        />
      )}

      {selected ? (
        <SkillEditor
          key={selected.id}
          detail={detail}
          skill={selected}
          linkMode={linkMode}
          onLinkMode={onLinkMode}
          onClose={() => onSelect(null)}
          run={run}
        />
      ) : (
        <Regions detail={detail} run={run} />
      )}
    </aside>
  );
}

function useBusy() {
  const [count, setCount] = useState(0);
  return {
    on: count > 0,
    wrap<T>(promise: Promise<T>): Promise<T> {
      setCount((value) => value + 1);
      return promise.finally(() => setCount((value) => value - 1));
    },
  };
}

type Run = (path: string, method: string, body?: object) => Promise<MapWrite | null>;

function RegionSelect({ detail, value, onChange }: { detail: SubjectDetail; value: string; onChange: (unitId: string) => void }) {
  return (
    <label className="form-label">Region
      <select className="form-input py-2.5" value={value} onChange={(event) => onChange(event.target.value)}>
        {detail.units.length === 0 && <option value="">New region</option>}
        {detail.units.map((unit) => <option key={unit.id} value={unit.id}>{unit.title}</option>)}
      </select>
    </label>
  );
}

function NewSkill({ detail, near, onCancel, onCreate }: {
  detail: SubjectDetail;
  near: Skill | null;
  onCancel: () => void;
  onCreate: (fields: { title: string; description: string; unitId?: string; linkTo: string[] }) => Promise<void>;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [unitId, setUnitId] = useState(near?.unitId ?? detail.units[0]?.id ?? "");
  const [link, setLink] = useState(Boolean(near));
  useEffect(() => { if (near) setUnitId(near.unitId); setLink(Boolean(near)); }, [near]);

  function submit(event: FormEvent) {
    event.preventDefault();
    void onCreate({ title, description, ...(unitId ? { unitId } : {}), linkTo: link && near ? [near.id] : [] });
  }

  return (
    <form className="map-panel" onSubmit={submit}>
      <div className="flex items-center justify-between">
        <h2 className="map-panel-title">New skill</h2>
        <button type="button" className="rounded-lg p-1.5 text-wolf hover:bg-eel" onClick={onCancel} aria-label="Cancel new skill"><IconX size={18} /></button>
      </div>
      <label className="form-label">Name<input className="form-input" value={title} onChange={(event) => setTitle(event.target.value)} maxLength={120} required autoFocus /></label>
      <label className="form-label">Description<input className="form-input" value={description} onChange={(event) => setDescription(event.target.value)} maxLength={500} /></label>
      <RegionSelect detail={detail} value={unitId} onChange={setUnitId} />
      {near && (
        <label className="flex cursor-pointer items-center gap-2 text-sm font-bold text-ink">
          <input type="checkbox" className="size-5 accent-[var(--color-secondary)]" checked={link} onChange={(event) => setLink(event.target.checked)} />
          Link to {near.title}
        </label>
      )}
      <p className="text-xs font-semibold leading-5 text-wolf">Exercises are written by an agent: open Connect agent and ask it to fill this skill.</p>
      <Button type="submit" disabled={!title.trim()}>Create skill</Button>
    </form>
  );
}

function SkillEditor({ detail, skill, linkMode, onLinkMode, onClose, run }: {
  detail: SubjectDetail;
  skill: Skill;
  linkMode: boolean;
  onLinkMode: (on: boolean) => void;
  onClose: () => void;
  run: Run;
}) {
  const [title, setTitle] = useState(skill.title);
  const [description, setDescription] = useState(skill.description);
  const [confirming, setConfirming] = useState(false);
  const dirty = title.trim() !== skill.title || description.trim() !== skill.description;
  const titles = new Map(detail.units.flatMap((unit) => unit.skills).map((other) => [other.id, other.title]));
  const links = detail.links.flatMap(([a, b]) => (a === skill.id ? [b] : b === skill.id ? [a] : []));
  const patch = (fields: object) => run(`/api/skills/${skill.id}`, "PATCH", fields);

  return (
    <div className="map-panel">
      <div className="flex items-center justify-between">
        <h2 className="map-panel-title">Skill</h2>
        <button type="button" className="rounded-lg p-1.5 text-wolf hover:bg-eel" onClick={onClose} aria-label="Close skill"><IconX size={18} /></button>
      </div>
      <form className="flex flex-col gap-3" onSubmit={(event) => { event.preventDefault(); void patch({ title, description }); }}>
        <label className="form-label">Name<input className="form-input" value={title} onChange={(event) => setTitle(event.target.value)} maxLength={120} required /></label>
        <label className="form-label">Description<input className="form-input" value={description} onChange={(event) => setDescription(event.target.value)} maxLength={500} /></label>
        {dirty && <Button type="submit" disabled={!title.trim()}>Save</Button>}
      </form>
      <RegionSelect detail={detail} value={skill.unitId} onChange={(unitId) => void patch({ unitId })} />
      <label className="flex cursor-pointer items-start gap-3 rounded-xl bg-eel p-3">
        <input type="checkbox" className="mt-0.5 size-5 shrink-0 accent-[var(--color-secondary)]" checked={skill.start} onChange={(event) => void patch({ start: event.target.checked })} />
        <span>
          <span className="block text-sm font-extrabold text-ink">Start skill</span>
          <span className="block text-xs font-semibold leading-5 text-wolf">Where learning begins. Without one, the first skill is the start.</span>
        </span>
      </label>

      <div>
        <h3 className="map-panel-title">Links</h3>
        {links.length === 0 ? <p className="mt-1 text-sm font-semibold text-wolf">Not linked to anything yet.</p> : (
          <ul className="mt-2 flex flex-wrap gap-2">
            {links.map((other) => (
              <li key={other} className="flex items-center gap-1 rounded-xl bg-eel py-1 pl-3 pr-1 text-sm font-bold">
                {titles.get(other)}
                <button type="button" className="rounded-lg p-1 text-wolf hover:bg-swan hover:text-ink" onClick={() => void run(`/api/skills/${skill.id}/links/${other}`, "DELETE")} aria-label={`Unlink ${titles.get(other)}`}><IconX size={15} /></button>
              </li>
            ))}
          </ul>
        )}
        <Button variant={linkMode ? "primary" : "secondary"} className="mt-3 w-full gap-2" onClick={() => onLinkMode(!linkMode)} aria-pressed={linkMode}>
          <IconLink size={18} />{linkMode ? "Done linking" : "Link skills"}
        </Button>
        {linkMode && <p className="mt-2 text-xs font-semibold leading-5 text-wolf">Click skills on the map to link them to {skill.title}. Click a linked one again to unlink it.</p>}
      </div>

      {confirming ? (
        <div className="rounded-xl bg-eel p-3">
          <p className="text-sm font-bold text-ink">Delete {skill.title}, its exercises and your progress on it?</p>
          <div className="mt-3 flex gap-2">
            <Button variant="secondary" className="flex-1" onClick={() => setConfirming(false)}>Keep</Button>
            <Button variant="danger" className="flex-1" onClick={() => void run(`/api/skills/${skill.id}`, "DELETE").then((result) => { if (result) onClose(); })}>Delete</Button>
          </div>
        </div>
      ) : (
        <button type="button" className="flex items-center justify-center gap-2 rounded-xl py-2 text-sm font-extrabold text-cardinal hover:bg-eel" onClick={() => setConfirming(true)}><IconTrash size={17} />Delete skill</button>
      )}
    </div>
  );
}

function Regions({ detail, run }: { detail: SubjectDetail; run: Run }) {
  const colors = regionColors(detail);
  const [confirming, setConfirming] = useState<string | null>(null);
  if (!detail.units.length) return null;
  return (
    <div className="map-panel">
      <h2 className="map-panel-title">Regions</h2>
      <p className="-mt-2 text-xs font-semibold leading-5 text-wolf">Click a skill on the map to edit it. Regions group skills into areas of the map.</p>
      <ul className="flex flex-col gap-2">
        {detail.units.map((unit) => (
          <li key={unit.id} className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <span className="size-4 shrink-0 rounded-full" style={{ background: colors.get(unit.id) }} aria-hidden="true" />
              <input
                className="form-input min-w-0 flex-1 py-2"
                defaultValue={unit.title}
                key={unit.title}
                maxLength={120}
                aria-label="Region name"
                onBlur={(event) => { const title = event.target.value.trim(); if (title && title !== unit.title) void run(`/api/regions/${unit.id}`, "PATCH", { title }); else event.target.value = unit.title; }}
                onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); }}
              />
              <span className="w-8 shrink-0 text-right text-xs font-black text-wolf" title="Skills">{unit.skills.length}</span>
              <button type="button" className="rounded-lg p-2 text-wolf hover:bg-eel hover:text-cardinal" onClick={() => setConfirming(unit.id)} aria-label={`Delete ${unit.title}`}><IconTrash size={17} /></button>
            </div>
            {confirming === unit.id && (
              <div className="rounded-xl bg-eel p-3">
                <p className="text-sm font-bold text-ink">{unit.skills.length ? `Delete ${unit.title} and its ${unit.skills.length} skill${unit.skills.length === 1 ? "" : "s"}?` : `Delete ${unit.title}?`}</p>
                <div className="mt-3 flex gap-2">
                  <Button variant="secondary" className="flex-1" onClick={() => setConfirming(null)}>Keep</Button>
                  <Button variant="danger" className="flex-1" onClick={() => void run(`/api/regions/${unit.id}`, "DELETE").then(() => setConfirming(null))}>Delete</Button>
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
