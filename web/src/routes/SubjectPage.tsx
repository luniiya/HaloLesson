import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import { IconArrowLeft, IconBroadcast, IconCheck, IconCircleDashed, IconPencil, IconShare } from "@tabler/icons-react";
import { START_NODE, type SubjectDetail } from "@halolesson/shared";
import { api } from "$lib/api";
import { useLibraryEvents } from "$lib/events";
import MapEditor from "../components/MapEditor";
import ShareDialog from "../components/ShareDialog";
import SkillMap from "../components/SkillMap";
import SkillPreview from "../components/SkillPreview";
import TrackerView from "../components/TrackerView";

export default function SubjectPage() {
  const { subjectId = "" } = useParams();
  const [detail, setDetail] = useState<SubjectDetail | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [linkMode, setLinkMode] = useState(false);
  const [linkError, setLinkError] = useState("");
  const [error, setError] = useState("");
  const [live, setLive] = useState(false);
  const [sharing, setSharing] = useState(false);

  useEffect(() => {
    let active = true;
    setDetail(null);
    setSelectedId(null);
    setEditing(false);
    setLinkMode(false);
    setError("");
    api<SubjectDetail>(`/api/subjects/${encodeURIComponent(subjectId)}`)
      .then((data) => { if (active) setDetail(data); })
      .catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : "Could not load subject"); });
    return () => { active = false; };
  }, [subjectId]);

  // Refetch in place when an agent (or another tab) edits this subject, so the
  // path fills in live without a loading flash.
  const refresh = useCallback(() => {
    api<SubjectDetail>(`/api/subjects/${encodeURIComponent(subjectId)}`)
      .then((data) => {
        setDetail(data);
        setLive(true);
      })
      .catch((cause) => setError(cause instanceof Error ? cause.message : "Could not load subject"));
  }, [subjectId]);
  useLibraryEvents((event) => {
    if (event.subjectId === null || event.subjectId === subjectId) refresh();
  });
  useEffect(() => {
    if (!live) return;
    const timer = setTimeout(() => setLive(false), 4000);
    return () => clearTimeout(timer);
  }, [live, detail]);

  useEffect(() => {
    if (!linkMode) return;
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") setLinkMode(false); };
    window.addEventListener("keydown", escape);
    return () => window.removeEventListener("keydown", escape);
  }, [linkMode]);

  const skills = detail?.units.flatMap((unit) => unit.skills) ?? [];
  const selectedSkill = skills.find((skill) => skill.id === selectedId) ?? null;

  // In link mode a click links the node (a skill or the start flag) to the
  // selected one, or unlinks it. A skill linked to the flag is a start skill.
  async function select(id: string) {
    setLinkError("");
    if (!(editing && linkMode && selectedId && id !== selectedId)) {
      setSelectedId(id);
      return;
    }
    const flagLink = id === START_NODE || selectedId === START_NODE;
    const isLinked = flagLink
      ? Boolean(skills.find((skill) => skill.id === (id === START_NODE ? selectedId : id))?.start)
      : detail!.links.some(([a, b]) => (a === selectedId && b === id) || (b === selectedId && a === id));
    try {
      const result = await api<{ detail: SubjectDetail }>(`/api/skills/${selectedId}/links/${id}`, { method: isLinked ? "DELETE" : "PUT" });
      setDetail(result.detail);
    } catch (cause) {
      setLinkError(cause instanceof Error ? cause.message : "Couldn't link those skills");
    }
  }

  function toggleEditing() {
    setEditing((value) => !value);
    setLinkMode(false);
  }

  if (error) return <div className="mx-auto max-w-3xl p-8"><p role="alert" className="rounded-xl bg-red-50 p-4 font-bold text-cardinal">{error}</p><Link to="/" className="mt-5 inline-block font-extrabold text-secondary">Back to subjects</Link></div>;
  if (!detail) return <p className="p-12 text-center font-bold text-wolf">Loading subject…</p>;
  const isTracker = detail.subject.type === "tracker";

  const liveBadge = live && <span className="inline-flex items-center gap-1 rounded-full bg-gem/15 px-2 py-0.5 text-[11px] tracking-wider text-gem" role="status"><IconBroadcast size={13} aria-hidden="true" />Updated live</span>;

  if (isTracker) {
    return (
      <div className="mx-auto max-w-4xl px-5 pb-24 pt-8 sm:px-8 md:pb-12">
        <Link to="/" className="inline-flex items-center gap-2 text-sm font-extrabold text-wolf hover:text-accent-deep"><IconArrowLeft size={18} />All subjects</Link>
        <header className="mt-6 border-b-2 border-swan pb-8">
          <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.16em] text-accent-deep">Tracker{liveBadge}</p>
          <h1 className="mt-1 min-w-0 text-3xl font-black">{detail.subject.name}</h1>
          {detail.subject.description && <p className="mt-2 font-semibold leading-6 text-wolf">{detail.subject.description}</p>}
        </header>
        <TrackerView subject={detail.subject} />
      </div>
    );
  }

  // A subject is its map, full page; the title, the actions, the editor and
  // the selected skill float above it.
  return (
    <div className={`subject-map-page ${editing ? "subject-map-editing" : ""}`}>
      {skills.length > 0 || editing ? (
        <SkillMap detail={detail} selectedId={selectedId} linkMode={editing && linkMode} onSelect={(id) => void select(id)} onBackground={() => { if (!linkMode) setSelectedId(null); }} />
      ) : (
        <section className="grid h-full place-items-center px-6 text-center">
          <div>
            <div className="mx-auto mb-5 grid size-20 place-items-center rounded-full bg-secondary-pale text-secondary" aria-hidden="true"><IconCircleDashed size={38} /></div>
            <h2 className="text-2xl font-black">This map is ready for skills</h2>
            <p className="mx-auto mt-2 max-w-md text-sm font-semibold leading-6 text-wolf">Add skills and link them yourself, or use <Link to="/agent" className="font-extrabold text-secondary">Connect agent</Link> to build the map with exercises. Skills appear here live.</p>
            <button type="button" className="button button-primary mt-6 gap-2" onClick={toggleEditing}><IconPencil size={19} />Start the map</button>
          </div>
        </section>
      )}

      <div className="map-topbar">
        <header className="map-float map-title">
          <Link to="/" className="inline-flex items-center gap-1.5 text-xs font-extrabold text-wolf hover:text-accent-deep"><IconArrowLeft size={15} />All subjects</Link>
          <p className="mt-2 flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.16em] text-accent-deep">Practice path{liveBadge}</p>
          <h1 className="truncate text-xl font-black sm:text-2xl">{detail.subject.name}</h1>
          {detail.subject.description && <p className="mt-0.5 line-clamp-2 text-sm font-semibold leading-5 text-wolf">{detail.subject.description}</p>}
        </header>
        <div className="map-float map-actions">
          <button type="button" className={`button shrink-0 gap-2 ${editing ? "button-primary" : "button-secondary"}`} onClick={toggleEditing} aria-pressed={editing}>
            {editing ? <IconCheck size={19} /> : <IconPencil size={19} />}<span className="hidden sm:inline">{editing ? "Done" : "Edit map"}</span>
          </button>
          <button type="button" className="button button-secondary shrink-0 gap-2" onClick={() => setSharing(true)} aria-label="Share">
            <IconShare size={19} /><span className="hidden sm:inline">Share</span>
          </button>
        </div>
      </div>

      {linkError && <p role="alert" className="notice-error map-link-error">{linkError}</p>}

      {editing && (
        <div className="map-editor-float">
          <MapEditor
            detail={detail}
            selected={selectedSkill}
            flagSelected={selectedId === START_NODE}
            linkMode={linkMode}
            onDetail={setDetail}
            onSelect={(id) => { setSelectedId(id); if (!id) setLinkMode(false); }}
            onLinkMode={setLinkMode}
          />
        </div>
      )}

      {!editing && selectedSkill && <SkillPreview skill={selectedSkill} unlockTier={detail.subject.unlockTier} onClose={() => setSelectedId(null)} />}

      {sharing && <ShareDialog subjectId={subjectId} onClose={() => setSharing(false)} />}
    </div>
  );
}
