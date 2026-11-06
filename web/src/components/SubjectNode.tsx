import type { CSSProperties, MouseEvent } from "react";
import { flushSync } from "react-dom";
import { Link, useNavigate } from "react-router";
import type { Icon } from "@tabler/icons-react";
import { IconFolder } from "@tabler/icons-react";
import type { Folder, Subject } from "@halolesson/shared";
import { mixColors } from "$lib/colors";
import { iconFor } from "$lib/subjectIcons";

const colors = {
  green: ["#58cc02", "#46a302", "#89e219"],
  blue: ["#1cb0f6", "#1899d6", "#66d4ff"],
  purple: ["#ce82ff", "#a560d8", "#e2b0ff"],
  orange: ["#ff9600", "#cc7a00", "#ffbe45"],
  red: ["#ff4b4b", "#cc3b3b", "#ff8585"],
};

interface OrbitNodeProps {
  index: number;
  total: number;
  color: string;
  dark: string;
  Symbol: Icon;
  label: string;
  meta: string;
  ariaLabel: string;
  to?: string;
  onOpen?: () => void;
  // Off-ring placement (folder fans): replaces the ring angle and adds classes.
  place?: { style?: CSSProperties; className?: string; expanded?: boolean };
}

// One circle on the orbit: a link (subjects) or a button (folders).
function OrbitNode({ index, total, color, dark, Symbol, label, meta, ariaLabel, to, onOpen, place }: OrbitNodeProps) {
  const navigate = useNavigate();
  const style = { "--level": color, "--level-dark": dark, "--angle": `${-90 + index * 360 / total}deg`, ...place?.style } as CSSProperties;

  function openSubject(event: MouseEvent<HTMLAnchorElement>) {
    if (!to || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!document.startViewTransition || reducedMotion) return;
    event.preventDefault();
    document.startViewTransition(() => flushSync(() => navigate(to)));
  }

  const face = <OrbitFace Symbol={Symbol} label={label} meta={meta} />;

  return (
    <div className={`subject-node-position ${place?.className ?? ""}`} style={style}>
      {to ? (
        <Link to={to} onClick={openSubject} className="level subject-node group" aria-label={ariaLabel}>{face}</Link>
      ) : (
        <button type="button" onClick={onOpen} className="level subject-node group" aria-label={ariaLabel} aria-expanded={place?.expanded}>{face}</button>
      )}
    </div>
  );
}

// The circle itself plus its hover name tag. `drop` marks the face as a drag
// target (see LibraryOrbit); colors come from the wrapper's --level vars.
export function OrbitFace({ Symbol, label, meta, drop }: { Symbol: Icon; label: string; meta: string; drop?: string }) {
  return (
    <>
      <span className="level-ring" data-drop={drop}>
        <span className="level-button">
          <span className="level-ledge" />
          <span className="level-face"><Symbol stroke={2.4} aria-hidden="true" /></span>
        </span>
      </span>
      <span className="subject-node-tip" aria-hidden="true">
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

export const subjectMeta = (subject: Subject) => (subject.skillCount === 0 ? "New path" : `${subject.skillCount} ${subject.skillCount === 1 ? "skill" : "skills"}`);
export const folderMeta = (count: number) => `Folder · ${count} ${count === 1 ? "item" : "items"}`;

type Place = OrbitNodeProps["place"];

export default function SubjectNode({ subject, index = 0, total = 1, place }: { subject: Subject; index?: number; total?: number; place?: Place }) {
  return (
    <OrbitNode
      place={place}
      index={index}
      total={total}
      {...subjectColors(subject)}
      Symbol={iconFor(subject)}
      label={subject.name}
      meta={subjectMeta(subject)}
      ariaLabel={`Open ${subject.name}, ${subject.skillCount} skills`}
      to={`/subjects/${subject.id}`}
    />
  );
}

export function FolderNode({ folder, count, index = 0, total = 1, onOpen, place }: { folder: Folder; count: number; index?: number; total?: number; onOpen: () => void; place?: Place }) {
  return (
    <OrbitNode
      place={place}
      index={index}
      total={total}
      {...folderColors(folder)}
      Symbol={IconFolder}
      label={folder.name}
      meta={folderMeta(count)}
      ariaLabel={`${place?.expanded ? "Close" : "Open"} folder ${folder.name}, ${count} items`}
      onOpen={onOpen}
    />
  );
}
