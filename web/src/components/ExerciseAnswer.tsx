import { useState, type CSSProperties } from "react";
import { BLANK, type PracticeExercise } from "@halolesson/shared";
import MathText from "./MathText";

// Answer inputs for the order, match and fill_blanks exercises. Each reports
// the full answer once it is complete, or null while something is missing.
// Remount per question (key) to start empty.

type OnAnswer = (answer: string[] | null) => void;

// Order: tap the items in sequence; tap a placed one to send it back.
export function OrderAnswer({ exercise, disabled, onAnswer }: { exercise: PracticeExercise; disabled: boolean; onAnswer: OnAnswer }) {
  // Option indexes, so repeated items stay distinct.
  const [picked, setPicked] = useState<number[]>([]);
  const update = (next: number[]) => {
    setPicked(next);
    onAnswer(next.length === exercise.options.length ? next.map((index) => exercise.options[index]!) : null);
  };
  return (
    <div className="grid gap-5">
      <ol className="practice-order-line" aria-label="Your order">
        {picked.length === 0 && <li className="text-sm font-bold text-wolf">Tap the items below in the right order</li>}
        {picked.map((index, position) => (
          <li key={index}>
            <button type="button" className="practice-chip practice-chip-placed" disabled={disabled} onClick={() => update(picked.filter((item) => item !== index))} aria-label={`Remove ${exercise.options[index]} (position ${position + 1})`}>
              <span className="practice-chip-number">{position + 1}</span><MathText text={exercise.options[index]!} />
            </button>
          </li>
        ))}
      </ol>
      <div className="flex flex-wrap gap-3" aria-label="Items to place">
        {exercise.options.map((option, index) => (
          <button key={index} type="button" className={`practice-chip ${picked.includes(index) ? "invisible" : ""}`} disabled={disabled || picked.includes(index)} onClick={() => update([...picked, index])}>
            <MathText text={option} />
          </button>
        ))}
      </div>
    </div>
  );
}

const PAIR_COLORS = ["#1cb0f6", "#ce82ff", "#ff9600", "#2bb673", "#ff4b4b", "#ffc800", "#2b70c9", "#a5ed6e"];

// Match: pick an item on each side to pair them; tap a paired item to undo.
export function MatchAnswer({ exercise, disabled, onAnswer }: { exercise: PracticeExercise; disabled: boolean; onAnswer: OnAnswer }) {
  const left = exercise.left ?? [];
  // Right option index for each left item, or -1.
  const [pairs, setPairs] = useState<number[]>(() => left.map(() => -1));
  const [selected, setSelected] = useState<{ side: "left" | "right"; index: number } | null>(null);

  const update = (next: number[]) => {
    setPairs(next);
    setSelected(null);
    onAnswer(next.every((right) => right >= 0) ? next.map((right) => exercise.options[right]!) : null);
  };
  const pick = (side: "left" | "right", index: number) => {
    const leftIndex = side === "left" ? index : pairs.indexOf(index);
    if (leftIndex >= 0 && pairs[leftIndex]! >= 0) return update(pairs.map((right, i) => (i === leftIndex ? -1 : right)));
    if (!selected || selected.side === side) return setSelected(selected?.side === side && selected.index === index ? null : { side, index });
    const [l, r] = side === "left" ? [index, selected.index] : [selected.index, index];
    update(pairs.map((right, i) => (i === l ? r : right)));
  };
  const chip = (side: "left" | "right", index: number, text: string) => {
    const pair = side === "left" ? (pairs[index]! >= 0 ? index : -1) : pairs.indexOf(index);
    const isSelected = selected?.side === side && selected.index === index;
    const color = pair >= 0 ? PAIR_COLORS[pair % PAIR_COLORS.length] : undefined;
    return (
      <button key={index} type="button" disabled={disabled} onClick={() => pick(side, index)} aria-pressed={isSelected || pair >= 0}
        className={`practice-chip w-full justify-start ${isSelected ? "practice-chip-selected" : ""} ${pair >= 0 ? "practice-chip-paired" : ""}`}
        style={color ? { "--pair": color } as CSSProperties : undefined}>
        {pair >= 0 && <span className="practice-chip-number">{pair + 1}</span>}
        <MathText text={text} />
      </button>
    );
  };
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-5">
      <div className="grid content-start gap-3" aria-label="Left column">{left.map((text, index) => chip("left", index, text))}</div>
      <div className="grid content-start gap-3" aria-label="Right column">{exercise.options.map((text, index) => chip("right", index, text))}</div>
    </div>
  );
}

// Fill in the blanks: the prompt with an input in each gap.
export function BlanksAnswer({ exercise, disabled, onAnswer }: { exercise: PracticeExercise; disabled: boolean; onAnswer: OnAnswer }) {
  const parts = exercise.prompt.split(BLANK);
  const [values, setValues] = useState<string[]>(() => parts.slice(1).map(() => ""));
  const update = (index: number, value: string) => {
    const next = values.map((item, i) => (i === index ? value : item));
    setValues(next);
    onAnswer(next.every((item) => item.trim()) ? next : null);
  };
  return (
    <p className="text-2xl font-black leading-[2.4] sm:text-3xl">
      {parts.map((part, index) => (
        <span key={index}>
          <MathText text={part} />
          {index < values.length && (
            <input className="practice-blank" value={values[index]} onChange={(event) => update(index, event.target.value)} disabled={disabled}
              aria-label={`Blank ${index + 1}`} autoFocus={index === 0} style={{ width: `${Math.max(4, values[index]!.length + 1)}ch` }} />
          )}
        </span>
      ))}
    </p>
  );
}
