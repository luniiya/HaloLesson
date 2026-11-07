import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router";
import { IconHeartBroken, IconHeartFilled, IconStarFilled, IconVolume, IconVolumeOff, IconX } from "@tabler/icons-react";
import { TIER_LABELS, TIERS, type AttemptResult, type PracticeSession } from "@halolesson/shared";
import { api } from "$lib/api";
import { isMuted, play, setMuted } from "$lib/sounds";
import Button from "../components/Button";
import { MEDAL_COLORS } from "../components/SkillNode";

// One session on one tier of a skill (?tier=, else the next tier to clear).
// The server keeps the session: hearts, the queue (wrong answers come back at
// the end) and whether the tier was cleared.
export default function PracticePage() {
  const { skillId = "" } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [session, setSession] = useState<PracticeSession | null>(null);
  const [answer, setAnswer] = useState<string | number>("");
  const [result, setResult] = useState<AttemptResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [muted, setMutedState] = useState(isMuted);
  // When the current exercise appeared, for the time-practiced statistic.
  const shownAt = useRef(Date.now());
  const current = session?.queue[0] ?? null;
  useEffect(() => { shownAt.current = Date.now(); }, [current?.id, session?.answered]);

  const tier = params.get("tier");
  useEffect(() => {
    let active = true;
    api<PracticeSession>(`/api/skills/${encodeURIComponent(skillId)}/sessions`, { method: "POST", body: JSON.stringify(tier ? { tier } : {}) })
      .then((data) => { if (active) setSession(data); })
      .catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : "Could not start practice"); });
    return () => { active = false; };
  }, [skillId, tier]);

  async function checkAnswer(event: FormEvent) {
    event.preventDefault();
    if (!session || !current || answer === "" || submitting) return;
    setSubmitting(true);
    setError("");
    try {
      const attempt = await api<AttemptResult>(`/api/sessions/${session.id}/answer`, { method: "POST", body: JSON.stringify({ exerciseId: current.id, answer, durationMs: Date.now() - shownAt.current }) });
      setResult(attempt);
      play(attempt.session.status === "failed" ? "failed" : attempt.correct ? "correct" : "wrong");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not submit answer");
    } finally {
      setSubmitting(false);
    }
  }

  function next() {
    if (!result) return;
    if (result.session.status === "cleared") play("cleared");
    setSession(result.session);
    setAnswer("");
    setResult(null);
  }

  function exit() {
    if (session?.status === "active") void api(`/api/sessions/${session.id}/quit`, { method: "POST" }).catch(() => undefined);
    navigate(session ? `/subjects/${session.subjectId}` : "/");
  }

  function toggleSound() {
    setMuted(!muted);
    setMutedState(!muted);
  }

  if (error && !session) return <div className="mx-auto max-w-2xl p-8"><p role="alert" className="rounded-xl bg-red-50 p-4 font-bold text-cardinal">{error}</p><button type="button" onClick={() => navigate(-1)} className="mt-5 inline-block font-bold text-secondary">Go back</button></div>;
  if (!session) return <p className="p-12 text-center font-bold text-wolf">Preparing your practice…</p>;

  const shown = result?.session ?? session;
  const ended = session.status !== "active";
  const progress = session.total ? (shown.done / session.total) * 100 : 0;
  const tierLabel = TIER_LABELS[session.tier];
  const backToMap = `/subjects/${session.subjectId}`;

  return (
    <div className="practice-shell">
      <header className="practice-header">
        <button type="button" onClick={exit} className="rounded-lg p-2 text-wolf hover:bg-eel hover:text-ink" aria-label="Exit practice"><IconX size={24} /></button>
        <div className="practice-progress" role="progressbar" aria-label="Practice progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress)}><div style={{ width: `${progress}%` }} /></div>
        <span className="practice-hearts" aria-label={`${shown.heartsLeft} of ${shown.hearts} hearts left`}>
          <IconHeartFilled size={24} aria-hidden="true" />{shown.heartsLeft}
        </span>
        <button type="button" onClick={toggleSound} className="rounded-lg p-2 text-wolf hover:bg-eel hover:text-ink" aria-label={muted ? "Turn sounds on" : "Turn sounds off"} aria-pressed={!muted}>
          {muted ? <IconVolumeOff size={22} /> : <IconVolume size={22} />}
        </button>
      </header>

      {ended ? (
        <SessionEnd session={session} backToMap={backToMap} />
      ) : current && (
        <main className="practice-main">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-accent-deep">{session.subjectName} · {session.skillTitle} · {tierLabel}</p>
          <h1 className="mt-3 text-2xl font-black leading-tight sm:text-3xl">{current.prompt}</h1>
          <form onSubmit={checkAnswer} className="mt-8">
            {current.type === "multiple_choice" ? (
              <div className="grid gap-3" role="radiogroup" aria-label="Answer choices">
                {current.options.map((option, optionIndex) => (
                  <label key={optionIndex} className={`practice-option ${answer === optionIndex ? "practice-option-selected" : ""}`}>
                    <input type="radio" name="answer" checked={answer === optionIndex} onChange={() => setAnswer(optionIndex)} disabled={Boolean(result)} className="sr-only" />
                    <span className="grid size-8 shrink-0 place-items-center rounded-lg border-2 border-swan text-xs font-black">{String.fromCharCode(65 + optionIndex)}</span>
                    <span>{option}</span>
                  </label>
                ))}
              </div>
            ) : (
              <label className="form-label">Your answer<input key={`${current.id}-${session.answered}`} className="form-input text-lg" value={String(answer)} onChange={(event) => setAnswer(event.target.value)} disabled={Boolean(result)} placeholder="Type your answer…" autoFocus /></label>
            )}
            {error && <p role="alert" className="mt-4 text-sm font-bold text-cardinal">{error}</p>}
            {!result && <Button type="submit" className="mt-7 w-full" disabled={answer === "" || submitting}>{submitting ? "Checking…" : "Check answer"}</Button>}
          </form>
          {result && (
            <section className={`practice-feedback ${result.correct ? "practice-feedback-correct" : "practice-feedback-wrong"}`} aria-live="polite">
              <div className="flex-1">
                <h2 className="text-xl font-black">{result.correct ? "Exactly right!" : result.session.status === "failed" ? "Out of hearts" : "Not quite yet"}</h2>
                {!result.correct && <p className="mt-1 text-sm font-bold">Correct answer: {result.correctAnswer}</p>}
                {result.explanation && <p className="mt-2 text-sm font-semibold leading-6">{result.explanation}</p>}
                {result.requeued && <p className="mt-2 text-xs font-black uppercase tracking-wider">This one comes back at the end</p>}
              </div>
              <Button onClick={next} variant={result.correct ? "primary" : "secondary"} className="shrink-0" autoFocus>{result.session.status === "active" ? "Continue" : "Finish"}</Button>
            </section>
          )}
        </main>
      )}
    </div>
  );
}

function SessionEnd({ session, backToMap }: { session: PracticeSession; backToMap: string }) {
  const accuracy = session.answered ? Math.round((session.correct / session.answered) * 100) : 0;
  const tierLabel = TIER_LABELS[session.tier];
  const failed = session.status === "failed";
  const nextTier = TIERS[TIERS.indexOf(session.tier) + 1];
  const expert = session.tier === "expert";
  const [face, ledge] = failed ? ["var(--color-cardinal)", "#b83a3a"] : expert ? MEDAL_COLORS.gold : ["var(--color-bee)", "#d99a00"];
  return (
    <main className="practice-complete">
      <div className="grid size-28 place-items-center rounded-full text-white" style={{ background: face, boxShadow: `0 7px 0 ${ledge}` }} aria-hidden="true">
        {failed ? <IconHeartBroken size={62} /> : <IconStarFilled size={62} />}
      </div>
      <p className="mt-8 text-xs font-black uppercase tracking-[0.18em] text-accent-deep">{session.skillTitle} · {tierLabel}</p>
      <h1 className="mt-2 text-3xl font-black">{failed ? "Out of hearts" : expert ? "Gold!" : `${tierLabel} cleared!`}</h1>
      <p className="mt-3 font-semibold text-wolf">
        {failed
          ? "Your answers still count: the questions you missed will come first next time."
          : expert ? "You cleared Expert. Clear it again within two months to keep it gold."
          : nextTier ? `${TIER_LABELS[nextTier]} is open.` : ""}
      </p>
      <div className="mt-8 grid w-full grid-cols-2 gap-4">
        <div className="rounded-2xl border-2 border-swan p-5"><strong className="block text-3xl font-black text-accent-deep">{accuracy}%</strong><span className="text-xs font-black uppercase text-wolf">Accuracy</span></div>
        <div className="rounded-2xl border-2 border-swan p-5"><strong className="block text-3xl font-black text-secondary">{session.done}/{session.total}</strong><span className="text-xs font-black uppercase text-wolf">Questions done</span></div>
      </div>
      <Link to={failed ? "/" : backToMap} className="button button-primary mt-8 w-full">{failed ? "Back to main menu" : "Back to the map"}</Link>
      {failed && <Link to={backToMap} className="mt-4 font-bold text-secondary">Back to the map</Link>}
    </main>
  );
}
