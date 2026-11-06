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
  const dark = colors[subject.color][1];
  const color = subject.gradientStart;
  const hash = [...subject.id].reduce((value, character) => (value * 31 + character.charCodeAt(0)) >>> 0, 7);
  const Symbol = symbols[hash % symbols.length];
  const style = {
    "--level": color,
    "--level-dark": dark,
    "--angle": `${-90 + index * 360 / total}deg`,
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
      <Link to={`/subjects/${subject.id}`} onClick={openSubject} className="level subject-node group" aria-label={`Open ${subject.name}, ${subject.skillCount} skills`}>
        <span className="level-ring">
          <span className="level-button">
            <span className="level-ledge" />
            <span className="level-face"><Symbol stroke={2.4} aria-hidden="true" /></span>
          </span>
        </span>
        <span className="subject-node-tip" aria-hidden="true">
          <span className="subject-node-label">{subject.name}</span>
          <span className="subject-node-meta">{subject.skillCount === 0 ? "New path" : `${subject.skillCount} ${subject.skillCount === 1 ? "skill" : "skills"}`}</span>
        </span>
      </Link>
    </div>
  );
}
