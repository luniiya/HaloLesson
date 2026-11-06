import type { CSSProperties } from "react";
import { LEVEL_LABELS, MAX_LEVEL } from "@halolesson/shared";

interface Props {
  // null: not rated yet (the thumb rests at 0 until the user drags it).
  value: number | null;
  onChange: (level: number) => void;
  label?: string;
}

// Self-rated level, 0 to MAX_LEVEL. The label under the number follows the
// thumb so the user always knows what the step they're on means.
export default function LevelSlider({ value, onChange, label = "Your level" }: Props) {
  const shown = value ?? 0;
  return (
    <div className="flex items-center gap-5">
      <div className={`level-bubble ${value === null ? "level-bubble-unrated" : ""}`} aria-hidden="true">
        <span className="text-[0.625rem] font-black uppercase tracking-widest opacity-80">Lv</span>
        <span className="text-3xl font-black leading-none">{value ?? "?"}</span>
      </div>
      <label className="flex min-w-0 flex-1 flex-col gap-2">
        <span className="flex items-baseline justify-between gap-3">
          <span className="text-sm font-extrabold text-wolf">{label}</span>
          <span className="text-right text-base font-black text-ink" aria-live="polite">{value === null ? "Not rated yet" : LEVEL_LABELS[value]}</span>
        </span>
        <input
          type="range"
          min={0}
          max={MAX_LEVEL}
          step={1}
          value={shown}
          onChange={(event) => onChange(Number(event.target.value))}
          className={`level-slider ${value === null ? "level-slider-unrated" : ""}`}
          style={{ "--fill": `${(shown / MAX_LEVEL) * 100}%` } as CSSProperties}
          aria-valuetext={value === null ? "Not rated yet" : `${value}, ${LEVEL_LABELS[value]}`}
        />
        <span className="flex justify-between px-1 text-[0.6875rem] font-black text-hare" aria-hidden="true">
          {LEVEL_LABELS.map((_, step) => <span key={step} className={step === value ? "text-bee" : ""}>{step}</span>)}
        </span>
      </label>
    </div>
  );
}
