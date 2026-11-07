import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import { IconFocusCentered, IconMinus, IconPlus } from "@tabler/icons-react";
import { isFinished, MAP_SPACING, MAP_Y_SCALE, type Skill, type SubjectDetail } from "@halolesson/shared";
import { mixColors } from "$lib/colors";
import SkillNode from "./SkillNode";

// The subject's skill map. Positions come from the server's layout; the
// browser only draws them and lets you pan (drag) and zoom (wheel, pinch,
// buttons). Regions are soft blobs behind their skills, links are lines.

const PAD = MAP_SPACING * 1.4;
const BLOB = MAP_SPACING * 0.6;
const MIN_SCALE = 0.2;
const MAX_SCALE = 1.6;
// Movement before a press counts as a drag rather than a click.
const DRAG_PX = 5;

interface View {
  scale: number;
  x: number;
  y: number;
}

export function regionColors(detail: SubjectDetail): Map<string, string> {
  const { gradientStart, gradientEnd } = detail.subject;
  const count = detail.units.length;
  return new Map(detail.units.map((unit, index) => [unit.id, mixColors(gradientStart, gradientEnd, count <= 1 ? 0 : index / (count - 1))]));
}

export default function SkillMap({ detail, selectedId, linkMode, onSelect, onBackground }: {
  detail: SubjectDetail;
  selectedId: string | null;
  // When on, clicking a skill links it to (or unlinks it from) the selected one.
  linkMode: boolean;
  onSelect: (skill: Skill) => void;
  onBackground: () => void;
}) {
  const viewport = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [view, setView] = useState<View | null>(null);
  const colors = useMemo(() => regionColors(detail), [detail]);

  const skills = useMemo(() => detail.units.flatMap((unit) => unit.skills.filter((skill) => skill.x !== null && skill.y !== null).map((skill) => ({ skill, unitId: unit.id }))), [detail]);
  const bounds = useMemo(() => {
    if (!skills.length) return { minX: 0, minY: 0, width: PAD * 2, height: PAD * 2 };
    const xs = skills.map(({ skill }) => skill.x!);
    const ys = skills.map(({ skill }) => skill.y! * MAP_Y_SCALE);
    const minX = Math.min(...xs) - PAD;
    const minY = Math.min(...ys) - PAD;
    return { minX, minY, width: Math.max(...xs) + PAD - minX, height: Math.max(...ys) + PAD - minY };
  }, [skills]);
  // Drawn y is squashed (MAP_Y_SCALE) so the map reads as a tilted plane.
  const at = useCallback((skill: Skill) => ({ x: skill.x! - bounds.minX, y: skill.y! * MAP_Y_SCALE - bounds.minY }), [bounds]);
  const byId = useMemo(() => new Map(skills.map(({ skill }) => [skill.id, skill])), [skills]);
  const linked = useMemo(() => new Set(detail.links.flatMap(([a, b]) => (a === selectedId ? [b] : b === selectedId ? [a] : []))), [detail.links, selectedId]);

  useLayoutEffect(() => {
    const node = viewport.current;
    if (!node) return;
    const observer = new ResizeObserver(([entry]) => setSize({ width: entry!.contentRect.width, height: entry!.contentRect.height }));
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  // Fit the whole map, never zooming in past 100%. Big maps open on their
  // start instead, where the whole map would be too small to read.
  const fit = useCallback((whole = false): View | null => {
    if (!size.width || !size.height) return null;
    const scale = Math.min(1, size.width / bounds.width, size.height / bounds.height);
    if (whole || scale >= 0.45 || !skills.length) {
      const fitted = Math.max(scale, MIN_SCALE);
      return { scale: fitted, x: (size.width - bounds.width * fitted) / 2, y: (size.height - bounds.height * fitted) / 2 };
    }
    const start = skills.find(({ skill }) => skill.start)?.skill ?? skills[0]!.skill;
    const point = at(start);
    return { scale: 0.7, x: size.width / 2 - point.x * 0.7, y: size.height / 2 - point.y * 0.7 };
  }, [size, bounds, skills, at]);

  // Fit when the subject opens (and once its first skills arrive), not on every live update.
  const fittedFor = useRef("");
  useEffect(() => {
    const key = `${detail.subject.id}:${skills.length > 0}`;
    if (fittedFor.current === key) return;
    const next = fit();
    if (!next) return;
    fittedFor.current = key;
    setView(next);
  }, [detail.subject.id, skills.length, fit]);

  const zoomAround = useCallback((factor: number, cx: number, cy: number) => {
    setView((current) => {
      if (!current) return current;
      const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, current.scale * factor));
      const ratio = scale / current.scale;
      return { scale, x: cx - (cx - current.x) * ratio, y: cy - (cy - current.y) * ratio };
    });
  }, []);

  useEffect(() => {
    const node = viewport.current;
    if (!node) return;
    const wheel = (event: WheelEvent) => {
      event.preventDefault();
      const rect = node.getBoundingClientRect();
      const delta = event.deltaMode === 1 ? event.deltaY * 33 : event.deltaY;
      zoomAround(Math.exp(-delta * 0.0018), event.clientX - rect.left, event.clientY - rect.top);
    };
    node.addEventListener("wheel", wheel, { passive: false });
    return () => node.removeEventListener("wheel", wheel);
  }, [zoomAround]);

  // Drag to pan with one pointer, pinch to zoom with two.
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{ startX: number; startY: number; dragging: boolean; distance: number } | null>(null);
  const suppressClick = useRef(false);

  function pointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const [one, two] = [...pointers.current.values()];
    gesture.current = { startX: event.clientX, startY: event.clientY, dragging: false, distance: one && two ? Math.hypot(one.x - two.x, one.y - two.y) : 0 };
    suppressClick.current = false;
  }

  function pointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const previous = pointers.current.get(event.pointerId);
    const current = gesture.current;
    if (!previous || !current) return;
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.current.size >= 2) {
      const [one, two] = [...pointers.current.values()];
      const distance = Math.hypot(one!.x - two!.x, one!.y - two!.y);
      const rect = viewport.current!.getBoundingClientRect();
      if (current.distance) zoomAround(distance / current.distance, (one!.x + two!.x) / 2 - rect.left, (one!.y + two!.y) / 2 - rect.top);
      current.distance = distance;
      current.dragging = true;
      suppressClick.current = true;
      return;
    }
    if (!current.dragging && Math.hypot(event.clientX - current.startX, event.clientY - current.startY) < DRAG_PX) return;
    if (!current.dragging) {
      current.dragging = true;
      suppressClick.current = true;
      viewport.current?.setPointerCapture(event.pointerId);
    }
    const dx = event.clientX - previous.x;
    const dy = event.clientY - previous.y;
    setView((view) => view && { ...view, x: view.x + dx, y: view.y + dy });
  }

  function pointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    pointers.current.delete(event.pointerId);
    if (pointers.current.size === 0) gesture.current = null;
  }

  const zoomButton = (factor: number) => zoomAround(factor, size.width / 2, size.height / 2);
  const regionOf = new Map(skills.map(({ skill, unitId }) => [skill.id, unitId]));

  return (
    <div className="skill-map">
      <div
        ref={viewport}
        className={`skill-map-viewport ${linkMode ? "skill-map-linking" : ""}`}
        onPointerDown={pointerDown}
        onPointerMove={pointerMove}
        onPointerUp={pointerUp}
        onPointerCancel={pointerUp}
        onClickCapture={(event) => {
          if (suppressClick.current) {
            event.stopPropagation();
            suppressClick.current = false;
          }
        }}
        onClick={(event) => { if (!(event.target as Element).closest("button")) onBackground(); }}
      >
        {view && (
          <div className="skill-map-world" style={{ width: bounds.width, height: bounds.height, transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})` }}>
            <svg className="skill-map-lines" width={bounds.width} height={bounds.height} aria-hidden="true">
              {detail.units.map((unit) => (
                <g key={unit.id} className="skill-map-region" fill={colors.get(unit.id)}>
                  {unit.skills.filter((skill) => byId.has(skill.id)).map((skill) => <ellipse key={skill.id} cx={at(skill).x} cy={at(skill).y} rx={BLOB} ry={BLOB * MAP_Y_SCALE} />)}
                </g>
              ))}
              {detail.links.map(([a, b]) => {
                const one = byId.get(a);
                const two = byId.get(b);
                if (!one || !two) return null;
                const done = isFinished(one, detail.subject.unlockTier) && isFinished(two, detail.subject.unlockTier);
                const active = a === selectedId || b === selectedId;
                return (
                  <line
                    key={`${a}-${b}`}
                    x1={at(one).x} y1={at(one).y} x2={at(two).x} y2={at(two).y}
                    className={`skill-map-link ${active ? "skill-map-link-active" : ""}`}
                    style={done && !active ? { stroke: colors.get(regionOf.get(a)!) } : undefined}
                  />
                );
              })}
            </svg>
            {detail.units.map((unit) => {
              const members = unit.skills.filter((skill) => byId.has(skill.id));
              if (!members.length) return null;
              const x = members.reduce((sum, skill) => sum + at(skill).x, 0) / members.length;
              const y = Math.min(...members.map((skill) => at(skill).y)) - BLOB * MAP_Y_SCALE - 6;
              return <span key={unit.id} className="skill-map-label" style={{ left: x, top: y, "--region": colors.get(unit.id) } as CSSProperties}>{unit.title}</span>;
            })}
            {skills.map(({ skill, unitId }) => {
              const base = colors.get(unitId)!;
              const point = at(skill);
              return (
                <SkillNode
                  key={skill.id}
                  skill={skill}
                  palette={[base, mixColors(base, "#000000", 0.25)]}
                  onSelect={onSelect}
                  className={`skill-node map-node ${linkMode && linked.has(skill.id) ? "map-node-linked" : ""}`}
                  pressed={skill.id === selectedId}
                  style={{ left: point.x, top: `calc(${point.y}px - var(--ring-size) / 2)` }}
                />
              );
            })}
          </div>
        )}
      </div>
      <div className="skill-map-zoom" role="group" aria-label="Zoom">
        <button type="button" onClick={() => zoomButton(1.25)} aria-label="Zoom in"><IconPlus size={20} stroke={2.6} /></button>
        <button type="button" onClick={() => zoomButton(0.8)} aria-label="Zoom out"><IconMinus size={20} stroke={2.6} /></button>
        <button type="button" onClick={() => setView(fit(true))} aria-label="Show the whole map"><IconFocusCentered size={20} stroke={2.4} /></button>
      </div>
    </div>
  );
}
