import { useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import { IconArrowLeft, IconCircleDashed, IconX } from "@tabler/icons-react";
import type { Skill, SubjectDetail } from "@halolesson/shared";
import { api } from "$lib/api";
import SkillPath from "../components/SkillPath";

export default function SubjectPage() {
  const { subjectId = "" } = useParams();
  const [detail, setDetail] = useState<SubjectDetail | null>(null);
  const [selectedSkill, setSelectedSkill] = useState<Skill | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setDetail(null);
    setSelectedSkill(null);
    setError("");
    api<SubjectDetail>(`/api/subjects/${encodeURIComponent(subjectId)}`)
      .then((data) => { if (active) setDetail(data); })
      .catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : "Could not load subject"); });
    return () => { active = false; };
  }, [subjectId]);

  if (error) return <div className="mx-auto max-w-3xl p-8"><p role="alert" className="rounded-xl bg-red-50 p-4 font-bold text-cardinal">{error}</p><Link to="/" className="mt-5 inline-block font-extrabold text-eel-blue">Back to subjects</Link></div>;
  if (!detail) return <p className="p-12 text-center font-bold text-wolf">Loading subject…</p>;

  return (
    <div className="mx-auto max-w-4xl px-5 pb-24 pt-8 sm:px-8 md:pb-12">
      <Link to="/" className="inline-flex items-center gap-2 text-sm font-extrabold text-wolf hover:text-owl-deep"><IconArrowLeft size={18} />All subjects</Link>
      <header className="mt-6 border-b-2 border-swan pb-8">
        <p className="text-xs font-black uppercase tracking-[0.16em] text-owl-deep">Practice path</p>
        <h1 className="mt-1 text-3xl font-black">{detail.subject.name}</h1>
        <p className="mt-2 max-w-2xl font-semibold leading-6 text-wolf">{detail.subject.description || "Your skills and practice progress will live here."}</p>
      </header>
      {detail.units.length === 0 ? (
        <section className="py-16 text-center">
          <div className="mx-auto mb-5 grid size-20 place-items-center rounded-full bg-blue-50 text-eel-blue" aria-hidden="true"><IconCircleDashed size={38} /></div>
          <h2 className="text-2xl font-black">This path is ready for skills</h2>
          <p className="mx-auto mt-2 max-w-md text-sm font-semibold leading-6 text-wolf">Units, procedural exercises, and mastery tracking are in the data model. Lesson authoring arrives with the AI generation phase.</p>
        </section>
      ) : (
        <>
          {selectedSkill && (
            <section className="skill-preview" aria-live="polite">
              <div className="min-w-0 flex-1">
                <p className="text-xs font-black uppercase tracking-wider text-owl-deep">Selected skill</p>
                <h2 className="mt-1 text-lg font-black">{selectedSkill.title}</h2>
                <p className="mt-1 text-sm font-semibold text-wolf">{selectedSkill.description || "Practice this skill whenever you want to strengthen it."}</p>
                <Link to={`/skills/${selectedSkill.id}/practice`} className="button button-primary mt-4">Practice now</Link>
              </div>
              <div className="shrink-0 text-right">
                <strong className="block text-2xl font-black text-owl-deep">{Math.round(selectedSkill.mastery * 100)}%</strong>
                <span className="text-xs font-extrabold uppercase text-wolf">Mastery</span>
              </div>
              <button type="button" onClick={() => setSelectedSkill(null)} className="absolute right-3 top-2 rounded-lg p-2 text-wolf hover:bg-eel hover:text-ink" aria-label="Close skill preview"><IconX size={18} /></button>
            </section>
          )}
          <SkillPath detail={detail} onSelect={setSelectedSkill} />
        </>
      )}
    </div>
  );
}
