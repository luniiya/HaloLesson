import type { CSSProperties, MouseEvent } from "react";
import { flushSync } from "react-dom";
import { Link, useNavigate } from "react-router";
import type { Subject } from "@halolesson/shared";
import { IconAtom, IconCode, IconFlask, IconMathFunction, IconPalette, IconWorld } from "@tabler/icons-react";

const colors = {
  green: ["#58cc02", "#46a302", "#89e219"],
  blue: ["#1cb0f6", "#1899d6", "#66d4ff"],
  purple: ["#ce82ff", "#a560d8", "#e2b0ff"],
  orange: ["#ff9600", "#cc7a00", "#ffbe45"],
  red: ["#ff4b4b", "#cc3b3b", "#ff8585"],
};

const symbols = [IconAtom, IconWorld, IconMathFunction, IconFlask, IconCode, IconPalette];

export default function SubjectNode({ subject, index, total }: { subject: Subject; index: number; total: number }) {
  const navigate = useNavigate();
  const angle = -90 + index * 360 / total;
  const radians = angle * Math.PI / 180;
  const dark = colors[subject.color][1];
  const color = subject.gradientStart;
  const light = subject.gradientEnd;
  const hash = [...subject.id].reduce((value, character) => (value * 31 + character.charCodeAt(0)) >>> 0, 7);
  const Symbol = symbols[hash % symbols.length];
  const style = {
    "--subject": color,
    "--subject-dark": dark,
    "--subject-light": light,
    left: `${50 + Math.cos(radians) * 38}%`,
    top: `${50 + Math.sin(radians) * 37}%`,
  } as CSSProperties;

  function openSubject(event: MouseEvent<HTMLAnchorElement>) {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!document.startViewTransition || reducedMotion) return;
    event.preventDefault();
    document.startViewTransition(() => flushSync(() => navigate(`/subjects/${subject.id}`)));
  }

  return (
    <div className="subject-node-position" style={style}>
      <Link to={`/subjects/${subject.id}`} onClick={openSubject} className="subject-node group" aria-label={`Open ${subject.name}, ${subject.skillCount} skills`}>
        <span className="subject-node-face"><Symbol size={48} stroke={2.2} aria-hidden="true" /></span>
        <span className="subject-node-label">{subject.name}</span>
        <span className="subject-node-meta">{subject.skillCount === 0 ? "New path" : `${subject.skillCount} ${subject.skillCount === 1 ? "skill" : "skills"}`}</span>
      </Link>
    </div>
  );
}
