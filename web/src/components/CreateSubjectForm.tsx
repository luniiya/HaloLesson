import { useState, type FormEvent } from "react";
import { SUBJECT_COLORS, type Subject, type SubjectColor } from "@halolesson/shared";
import { api } from "$lib/api";
import Button from "./Button";

const defaultGradients: Record<SubjectColor, [string, string]> = {
  green: ["#58cc02", "#1cb0f6"],
  blue: ["#1cb0f6", "#ce82ff"],
  purple: ["#ce82ff", "#ff4b4b"],
  orange: ["#ff9600", "#ff4b4b"],
  red: ["#ff4b4b", "#ce82ff"],
};

interface Props {
  onCreated: (subject: Subject) => void;
  onCancel: () => void;
}

export default function CreateSubjectForm({ onCreated, onCancel }: Props) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState<SubjectColor>("green");
  const [gradientStart, setGradientStart] = useState(defaultGradients.green[0]);
  const [gradientEnd, setGradientEnd] = useState(defaultGradients.green[1]);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function chooseColor(option: SubjectColor) {
    setColor(option);
    setGradientStart(defaultGradients[option][0]);
    setGradientEnd(defaultGradients[option][1]);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      onCreated(await api<Subject>("/api/subjects", {
        method: "POST",
        body: JSON.stringify({ name, description, color, gradientStart, gradientEnd }),
      }));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not create subject");
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit} className="mb-8 rounded-2xl border-2 border-swan bg-white p-5 shadow-[0_4px_0_#e5e5e5] sm:p-6">
      <div className="mb-5">
        <h2 className="text-xl font-black">Create a subject</h2>
        <p className="mt-1 text-sm font-semibold text-wolf">Start broad. You can break it into units and skills later.</p>
      </div>
      {error && <p role="alert" className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-bold text-cardinal">{error}</p>}
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="form-label sm:col-span-2">
          Subject name
          <input className="form-input" value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Physics" maxLength={80} required autoFocus />
        </label>
        <label className="form-label sm:col-span-2">
          Description <span className="font-semibold text-hare">(optional)</span>
          <textarea className="form-input min-h-24 resize-y" value={description} onChange={(event) => setDescription(event.target.value)} placeholder="What do you want to be able to do?" maxLength={500} />
        </label>
        <fieldset className="sm:col-span-2">
          <legend className="mb-2 text-sm font-extrabold text-wolf">Color</legend>
          <div className="flex flex-wrap gap-3">
            {SUBJECT_COLORS.map((option) => (
              <label key={option} className={`color-option color-${option} relative ${color === option ? "color-option-selected" : ""}`} title={option}>
                <input type="radio" name="color" value={option} checked={color === option} onChange={() => chooseColor(option)} className="absolute inset-0 z-10 m-0 size-full cursor-pointer opacity-0" />
                <span className="sr-only">{option}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <fieldset className="sm:col-span-2">
          <legend className="mb-2 text-sm font-extrabold text-wolf">Skill path gradient</legend>
          <div className="flex items-center gap-4 rounded-xl bg-eel p-3">
            <label className="gradient-control">Start<input type="color" value={gradientStart} onChange={(event) => setGradientStart(event.target.value)} aria-label="Gradient start color" /></label>
            <div className="h-4 flex-1 rounded-full" style={{ background: `linear-gradient(90deg, ${gradientStart}, ${gradientEnd})` }} aria-hidden="true" />
            <label className="gradient-control">End<input type="color" value={gradientEnd} onChange={(event) => setGradientEnd(event.target.value)} aria-label="Gradient end color" /></label>
          </div>
        </fieldset>
      </div>
      <div className="mt-6 flex justify-end gap-3">
        <Button variant="secondary" onClick={onCancel}>Cancel</Button>
        <Button type="submit" disabled={submitting}>{submitting ? "Creating…" : "Create subject"}</Button>
      </div>
    </form>
  );
}
