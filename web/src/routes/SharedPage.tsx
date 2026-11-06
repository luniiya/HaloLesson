import { useEffect, useState, type CSSProperties } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { IconBooks, IconLoader2, IconPlus } from "@tabler/icons-react";
import type { SharedSubject, Subject } from "@halolesson/shared";
import { api } from "$lib/api";
import { mixColors } from "$lib/colors";
import Button from "../components/Button";

// Preview of a subject someone shared: its outline only, plus a button that
// copies it into the viewer's library.
export default function SharedPage() {
  const { token = "" } = useParams();
  const navigate = useNavigate();
  const [shared, setShared] = useState<SharedSubject | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    setShared(null);
    setError("");
    api<SharedSubject>(`/api/shared/${encodeURIComponent(token)}`)
      .then((data) => { if (active) setShared(data); })
      .catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : "Could not load this link"); });
    return () => { active = false; };
  }, [token]);

  async function addCopy() {
    setError("");
    setBusy(true);
    try {
      const subject = await api<Subject>(`/api/shared/${encodeURIComponent(token)}/copy`, { method: "POST", body: "{}" });
      navigate(`/subjects/${subject.id}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not add this subject");
      setBusy(false);
    }
  }

  if (!shared) {
    if (!error) return <p className="p-12 text-center font-bold text-wolf">Loading shared subject…</p>;
    return (
      <div className="mx-auto max-w-3xl p-8">
        <p role="alert" className="rounded-xl bg-red-50 p-4 font-bold text-cardinal">This link doesn't work anymore. The owner may have stopped sharing it.</p>
        <Link to="/" className="mt-5 inline-block font-extrabold text-secondary">Back to subjects</Link>
      </div>
    );
  }

  const { subject, units } = shared;
  const banner = { "--unit": `linear-gradient(115deg, ${subject.gradientStart}, ${subject.gradientEnd})`, "--unit-dark": mixColors(subject.gradientEnd, "#000000", 0.25) } as CSSProperties;
  return (
    <div className="mx-auto max-w-3xl px-5 pb-24 pt-8 sm:px-8 md:pb-12">
      <header className="border-b-2 border-swan pb-8">
        <p className="text-xs font-black uppercase tracking-[0.16em] text-accent-deep">Shared by {shared.owner}</p>
        <h1 className="mt-1 text-3xl font-black">{subject.name}</h1>
        {subject.description && <p className="mt-2 font-semibold leading-6 text-wolf">{subject.description}</p>}
        <p className="mt-3 text-sm font-extrabold text-wolf">{subject.unitCount} {subject.unitCount === 1 ? "unit" : "units"} · {subject.skillCount} {subject.skillCount === 1 ? "skill" : "skills"}</p>
        {shared.isOwner ? (
          <p className="mt-5 rounded-xl bg-eel p-3.5 text-sm font-semibold text-wolf">This is your subject. This is what people see when they open your link.</p>
        ) : (
          <Button className="mt-5 gap-2" disabled={busy} aria-busy={busy} onClick={() => void addCopy()}>
            {busy ? <><IconLoader2 size={19} className="animate-spin" />Adding…</> : <><IconPlus size={19} />Add to my library</>}
          </Button>
        )}
        {error && <p role="alert" className="notice-error mt-4">{error}</p>}
      </header>
      {units.length === 0 ? (
        <p className="py-12 text-center font-bold text-wolf">This subject has no skills yet.</p>
      ) : (
        <div className="mt-8 space-y-8">
          {units.map((unit, index) => (
            <section key={index} aria-labelledby={`shared-unit-${index}`}>
              <header className="unit-banner" style={banner}>
                <div>
                  <p className="text-xs font-black uppercase tracking-wider opacity-80">Unit {index + 1}</p>
                  <h2 id={`shared-unit-${index}`} className="mt-0.5 text-xl font-black">{unit.title}</h2>
                  {unit.description && <p className="mt-1 text-sm font-bold opacity-90">{unit.description}</p>}
                </div>
                <span className="grid size-11 shrink-0 place-items-center rounded-xl border-2 border-white/35 bg-white/15" aria-hidden="true"><IconBooks size={22} /></span>
              </header>
              <ul className="mt-3 divide-y-2 divide-swan rounded-2xl border-2 border-swan">
                {unit.skills.map((skill, skillIndex) => (
                  <li key={skillIndex} className="flex items-start justify-between gap-4 p-4">
                    <div className="min-w-0">
                      <h3 className="font-black">{skill.title}</h3>
                      {skill.description && <p className="mt-0.5 text-sm font-semibold text-wolf">{skill.description}</p>}
                    </div>
                    <span className="shrink-0 text-xs font-extrabold uppercase text-wolf">{skill.exerciseCount} {skill.exerciseCount === 1 ? "exercise" : "exercises"}</span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
