import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { IconPlus } from "@tabler/icons-react";
import type { Subject } from "@halolesson/shared";
import { api } from "$lib/api";
import Button from "../components/Button";
import CreateSubjectForm from "../components/CreateSubjectForm";
import BookArtwork from "../components/BookArtwork";
import SubjectNode from "../components/SubjectNode";

export default function SubjectsPage() {
  const [subjects, setSubjects] = useState<Subject[] | null>(null);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    let active = true;
    api<Subject[]>("/api/subjects")
      .then((data) => { if (active) setSubjects(data); })
      .catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : "Could not load subjects"); });
    return () => { active = false; };
  }, []);

  const skillCount = subjects?.reduce((total, subject) => total + subject.skillCount, 0) ?? 0;

  return (
    <div className="mx-auto max-w-6xl px-5 pb-28 pt-8 sm:px-8 md:pb-16 md:pt-10 lg:px-10">
      <header className="mb-8 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-2 text-xs font-black uppercase tracking-[0.16em] text-owl-deep">My learning space</p>
          <h1 className="text-[2rem] font-black leading-tight tracking-tight sm:text-4xl">What will you level up?</h1>
          <p className="mt-2 text-[15px] font-semibold text-wolf">Pick what you need. Your practice, your pace.</p>
        </div>
        <Button onClick={() => setCreating(true)} className="shrink-0"><IconPlus className="mr-2" size={20} stroke={2.5} />New subject</Button>
      </header>

      {creating && <CreateSubjectForm onCancel={() => setCreating(false)} onCreated={(subject) => navigate(`/subjects/${subject.id}`)} />}
      {error && <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 font-bold text-cardinal">{error}</p>}
      {!subjects && !error && (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3" aria-label="Loading subjects">
          {[0, 1, 2].map((item) => <div key={item} className="h-72 animate-pulse rounded-2xl bg-eel" />)}
        </div>
      )}

      {subjects?.length === 0 && !creating && (
        <section className="relative overflow-hidden rounded-3xl border-2 border-swan bg-[#f9fff4] px-6 py-10 text-center sm:py-12">
          <BookArtwork className="mx-auto w-52" />
          <span className="mt-2 inline-block rounded-full bg-owl-pale px-3 py-1 text-xs font-black uppercase tracking-wider text-owl-deep">A fresh start</span>
          <h2 className="mt-4 text-3xl font-black tracking-tight">Build your first practice path</h2>
          <p className="mx-auto mt-3 max-w-md text-[15px] font-semibold leading-6 text-wolf">Start with something you’re studying. We’ll turn it into skills you can practice whenever they get rusty.</p>
          <Button className="mt-6" onClick={() => setCreating(true)}>Create my first subject</Button>
        </section>
      )}

      {subjects && subjects.length > 0 && (
        <section aria-labelledby="practice-paths-title">
          <h2 id="practice-paths-title" className="sr-only">Your practice paths</h2>
          <div className="subject-orbit-stage">
            <div className="subject-orbit-ring" aria-hidden="true" />
            <span className="orbit-speck left-[18%] top-[29%]" aria-hidden="true" />
            <span className="orbit-speck bottom-[23%] right-[17%] bg-eel-blue/50" aria-hidden="true" />
            <div className="subject-orbit-center">
              <BookArtwork className="w-40 sm:w-48" />
              <p className="-mt-2 text-xs font-black uppercase tracking-[0.14em] text-owl-deep">Your learning universe</p>
              <p className="mt-1 text-xs font-semibold text-wolf">Choose a path and jump back in.</p>
            </div>
            {subjects.map((subject, index) => (
              <SubjectNode key={subject.id} subject={subject} index={index} total={subjects.length} />
            ))}
          </div>
          <p className="text-center text-xs font-extrabold uppercase tracking-wider text-wolf">
            {subjects.length} {subjects.length === 1 ? "subject" : "subjects"}<span className="mx-2 text-swan">•</span>{skillCount} {skillCount === 1 ? "skill" : "skills"}<span className="mx-2 text-swan">•</span>Made by you
          </p>
        </section>
      )}
    </div>
  );
}
