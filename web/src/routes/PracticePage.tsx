import { useEffect, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router";
import { IconStarFilled, IconX } from "@tabler/icons-react";
import type { AttemptResult, PracticeSession } from "@halolesson/shared";
import { api } from "$lib/api";
import Button from "../components/Button";

export default function PracticePage() {
  const { skillId = "" } = useParams();
  const [session, setSession] = useState<PracticeSession | null>(null);
  const [index, setIndex] = useState(0);
  const [answer, setAnswer] = useState<string | number>("");
  const [result, setResult] = useState<AttemptResult | null>(null);
  const [correctCount, setCorrectCount] = useState(0);
  const [complete, setComplete] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    api<PracticeSession>(`/api/skills/${encodeURIComponent(skillId)}/practice`)
      .then((data) => { if (active) setSession(data); })
      .catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : "Could not load practice"); });
    return () => { active = false; };
  }, [skillId]);

  async function checkAnswer(event: FormEvent) {
    event.preventDefault();
    if (!session || answer === "" || submitting) return;
    setSubmitting(true);
    setError("");
    try {
      const attempt = await api<AttemptResult>(`/api/exercises/${session.exercises[index].id}/attempt`, { method: "POST", body: JSON.stringify({ answer }) });
      setResult(attempt);
      if (attempt.correct) setCorrectCount((count) => count + 1);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not submit answer");
    } finally {
      setSubmitting(false);
    }
  }

  function next() {
    if (!session) return;
    if (index === session.exercises.length - 1) {
      setComplete(true);
      return;
    }
    setIndex((value) => value + 1);
    setAnswer("");
    setResult(null);
  }

  if (error && !session) return <div className="mx-auto max-w-2xl p-8"><p role="alert" className="rounded-xl bg-red-50 p-4 font-bold text-cardinal">{error}</p><Link to="/" className="mt-5 inline-block font-bold text-secondary">Back to subjects</Link></div>;
  if (!session) return <p className="p-12 text-center font-bold text-wolf">Preparing your practice…</p>;
  if (session.exercises.length === 0) return <div className="mx-auto max-w-xl px-5 py-16 text-center"><h1 className="text-2xl font-black">No exercises yet</h1><p className="mt-3 font-semibold text-wolf">This skill is ready for exercises. Lesson generation arrives in the next phase.</p><Link to={`/subjects/${session.subjectId}`} className="button button-primary mt-6">Back to path</Link></div>;

  const exercise = session.exercises[index];
  const progress = complete ? 100 : (index + (result ? 1 : 0)) / session.exercises.length * 100;
  return (
    <div className="practice-shell">
      <header className="practice-header">
        <Link to={`/subjects/${session.subjectId}`} className="rounded-lg p-2 text-wolf hover:bg-eel hover:text-ink" aria-label="Exit practice"><IconX size={24} /></Link>
        <div className="practice-progress" role="progressbar" aria-label="Practice progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress)}><div style={{ width: `${progress}%` }} /></div>
        <span className="w-9 text-center text-sm font-black text-wolf">{Math.min(index + 1, session.exercises.length)}/{session.exercises.length}</span>
      </header>

      {complete ? (
        <main className="practice-complete">
          <div className="grid size-28 place-items-center rounded-full bg-bee text-white shadow-[0_7px_0_#d99a00]" aria-hidden="true"><IconStarFilled size={62} /></div>
          <p className="mt-8 text-xs font-black uppercase tracking-[0.18em] text-accent-deep">Practice complete</p>
          <h1 className="mt-2 text-3xl font-black">Nice work!</h1>
          <p className="mt-3 font-semibold text-wolf">You practiced {session.skillTitle}.</p>
          <div className="mt-8 grid w-full grid-cols-2 gap-4">
            <div className="rounded-2xl border-2 border-swan p-5"><strong className="block text-3xl font-black text-accent-deep">{Math.round(correctCount / session.exercises.length * 100)}%</strong><span className="text-xs font-black uppercase text-wolf">Accuracy</span></div>
            <div className="rounded-2xl border-2 border-swan p-5"><strong className="block text-3xl font-black text-secondary">{correctCount}/{session.exercises.length}</strong><span className="text-xs font-black uppercase text-wolf">Correct</span></div>
          </div>
          <Link to={`/subjects/${session.subjectId}`} className="button button-primary mt-8 w-full">Back to my path</Link>
        </main>
      ) : (
        <main className="practice-main">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-accent-deep">{session.subjectName} · {session.skillTitle}</p>
          <h1 className="mt-3 text-2xl font-black leading-tight sm:text-3xl">{exercise.prompt}</h1>
          <form onSubmit={checkAnswer} className="mt-8">
            {exercise.type === "multiple_choice" ? (
              <div className="grid gap-3" role="radiogroup" aria-label="Answer choices">
                {exercise.options.map((option, optionIndex) => (
                  <label key={option} className={`practice-option ${answer === optionIndex ? "practice-option-selected" : ""}`}>
                    <input type="radio" name="answer" checked={answer === optionIndex} onChange={() => setAnswer(optionIndex)} disabled={Boolean(result)} className="sr-only" />
                    <span className="grid size-8 shrink-0 place-items-center rounded-lg border-2 border-swan text-xs font-black">{String.fromCharCode(65 + optionIndex)}</span>
                    <span>{option}</span>
                  </label>
                ))}
              </div>
            ) : (
              <label className="form-label">Your answer<input className="form-input text-lg" value={String(answer)} onChange={(event) => setAnswer(event.target.value)} disabled={Boolean(result)} placeholder="Type your answer…" autoFocus /></label>
            )}
            {error && <p role="alert" className="mt-4 text-sm font-bold text-cardinal">{error}</p>}
            {!result && <Button type="submit" className="mt-7 w-full" disabled={answer === "" || submitting}>{submitting ? "Checking…" : "Check answer"}</Button>}
          </form>
          {result && (
            <section className={`practice-feedback ${result.correct ? "practice-feedback-correct" : "practice-feedback-wrong"}`} aria-live="polite">
              <div className="flex-1">
                <h2 className="text-xl font-black">{result.correct ? "Exactly right!" : "Not quite yet"}</h2>
                {!result.correct && <p className="mt-1 text-sm font-bold">Correct answer: {result.correctAnswer}</p>}
                {result.explanation && <p className="mt-2 text-sm font-semibold leading-6">{result.explanation}</p>}
              </div>
              <Button onClick={next} variant={result.correct ? "primary" : "secondary"} className="shrink-0">{index === session.exercises.length - 1 ? "Finish" : "Continue"}</Button>
            </section>
          )}
        </main>
      )}
    </div>
  );
}
