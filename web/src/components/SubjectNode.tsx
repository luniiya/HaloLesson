import { useEffect, useRef } from "react";
import type { Icon } from "@tabler/icons-react";
import { LEVEL_LABELS, MAX_LEVEL, type Folder, type Subject } from "@halolesson/shared";
import { mixColors } from "$lib/colors";

const colors = {
  green: ["#58cc02", "#46a302", "#89e219"],
  blue: ["#1cb0f6", "#1899d6", "#66d4ff"],
  purple: ["#ce82ff", "#a560d8", "#e2b0ff"],
  orange: ["#ff9600", "#cc7a00", "#ffbe45"],
  red: ["#ff4b4b", "#cc3b3b", "#ff8585"],
};

// One arc of a ring, in degrees clockwise from the top. `fill` arcs take the
// circle's color (or gold for levels); track arcs take the ring track color.
export interface RingArc {
  from: number;
  to: number;
  tone: "track" | "fill" | "gold";
}

// Drawn as SVG so arcs get round ends. A full circle is one arc from 0 to 360.
export function Ring({ arcs }: { arcs: RingArc[] }) {
  return (
    <svg className="level-ring-svg" viewBox="0 0 100 100" aria-hidden="true">
      {arcs.filter((arc) => arc.to - arc.from > 0.5).map((arc, index) => (
        <circle
          key={index}
          className={`level-ring-arc level-ring-${arc.tone}`}
          cx="50" cy="50" r="47.5" pathLength="360"
          strokeDasharray={`${arc.to - arc.from} 360`}
          strokeDashoffset={-arc.from}
          strokeLinecap={arc.to - arc.from >= 360 ? "butt" : "round"}
        />
      ))}
    </svg>
  );
}

// The circle itself plus its hover name tag. `drop` marks the face as a drag
// target (see LibraryOrbit); colors come from the wrapper's --level vars.
// `ring` replaces the plain progress ring with arcs (see subjectRing).
export function OrbitFace({ Symbol, label, meta, drop, ring }: { Symbol: Icon; label: string; meta: string; drop?: string; ring?: RingArc[] }) {
  const tip = useRef<HTMLSpanElement>(null);
  // The tag is centred under the circle; near the edge of the orbit's section
  // it would be cut off, so it slides sideways to stay inside when shown.
  useEffect(() => {
    const node = tip.current;
    const owner = node?.parentElement;
    if (!node || !owner) return;
    const keepInside = () => {
      node.style.setProperty("--tip-shift", "0px");
      const bounds = (node.closest("section") ?? document.body).getBoundingClientRect();
      const rect = node.getBoundingClientRect();
      const scale = rect.width / (node.offsetWidth || rect.width || 1);
      const margin = 8;
      const shift = rect.left < bounds.left + margin ? bounds.left + margin - rect.left : rect.right > bounds.right - margin ? bounds.right - margin - rect.right : 0;
      node.style.setProperty("--tip-shift", `${shift / scale}px`);
    };
    owner.addEventListener("pointerenter", keepInside);
    owner.addEventListener("focusin", keepInside);
    return () => {
      owner.removeEventListener("pointerenter", keepInside);
      owner.removeEventListener("focusin", keepInside);
    };
  }, []);
  return (
    <>
      <span className={`level-ring ${ring ? "level-ring-custom" : ""}`} data-drop={drop}>
        {ring && <Ring arcs={ring} />}
        <span className="level-button">
          <span className="level-ledge" />
          <span className="level-face"><Symbol stroke={2.4} aria-hidden="true" /></span>
        </span>
      </span>
      <span ref={tip} className="subject-node-tip" aria-hidden="true">
        <span className="subject-node-label">{label}</span>
        <span className="subject-node-meta">{meta}</span>
      </span>
    </>
  );
}

export function subjectColors(subject: Pick<Subject, "color" | "gradientStart">) {
  return { color: subject.gradientStart, dark: colors[subject.color][1] };
}

export function folderColors(folder: Pick<Folder, "color">) {
  return { color: folder.color, dark: mixColors(folder.color, "#000000", 0.25) };
}

export function subjectMeta(subject: Subject): string {
  const level = subject.level === null ? null : `Lv ${subject.level} · ${LEVEL_LABELS[subject.level]}`;
  if (subject.type === "tracker") return level ?? "Tracker · not rated";
  const skills = subject.skillCount === 0 ? "New path" : `${subject.completedCount}/${subject.skillCount} ${subject.skillCount === 1 ? "skill" : "skills"} done`;
  return level ? `${skills} · ${level}` : skills;
}

export const folderMeta = (count: number) => `Folder · ${count} ${count === 1 ? "item" : "items"}`;

// The ring around a subject's circle: a tracker's is its level in gold; a
// subject's is split, level (gold) on the right half and skill completion on
// the left, both filling from the top, with gaps at the top and bottom.
const GAP = 9;
export function subjectRing(subject: Subject): RingArc[] {
  const self = (subject.level ?? 0) / MAX_LEVEL;
  if (subject.type === "tracker") return [{ from: 0, to: 360, tone: "track" }, { from: 0, to: self * 360, tone: "gold" }];
  const done = subject.skillCount ? subject.completedCount / subject.skillCount : 0;
  const half = 180 - 2 * GAP;
  return [
    { from: GAP, to: 180 - GAP, tone: "track" },
    { from: 180 + GAP, to: 360 - GAP, tone: "track" },
    { from: GAP, to: GAP + self * half, tone: "gold" },
    { from: 360 - GAP - done * half, to: 360 - GAP, tone: "fill" },
  ];
}
