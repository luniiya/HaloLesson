import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode, type Ref } from "react";
import { libraryStates, type Library } from "@halolesson/shared";
import { entriesIn, type Entry } from "$lib/library";
import SubjectNode, { FolderNode } from "./SubjectNode";

// Stage coordinates are percent of the (square) stage. Ring nodes sit on
// --orbit-r (40%); an open folder fans its contents out away from the center.
const RING_R = 40;
const RING_NODE_R = 10;
const CHILD_NODE_R = 8;
const FAN_STEP = 36;
const FAN_MAX = 240;
const FAN_GAP = 19;

export interface Placed {
  entry: Entry | null; // null: the "empty folder" marker
  parentId: string | null;
  x: number;
  y: number;
  angle: number; // outward direction, degrees
  depth: number; // 0 = ring
  from?: { x: number; y: number };
}

const rad = (deg: number) => (deg * Math.PI) / 180;

// Children spread on an arc centered on the folder's outward direction. Past
// FAN_MAX degrees the arc gets longer instead of the circles overlapping.
function fan(parent: Placed, parentId: string, children: Entry[]): Placed[] {
  const count = Math.max(children.length, 1);
  const spread = Math.min(FAN_STEP * (count - 1), FAN_MAX);
  const step = count > 1 ? spread / (count - 1) : 0;
  const distance = Math.max(parent.depth === 0 ? 32 : 27, step ? FAN_GAP / (2 * Math.sin(rad(step) / 2)) : 0);
  const list: (Entry | null)[] = children.length ? children : [null];
  return list.map((entry, index) => {
    const angle = parent.angle - spread / 2 + index * step;
    return { entry, parentId, angle, depth: parent.depth + 1, x: parent.x + Math.cos(rad(angle)) * distance, y: parent.y + Math.sin(rad(angle)) * distance, from: { x: parent.x, y: parent.y } };
  });
}

export const activeEntries = (library: Library, folderId: string | null) => {
  const states = libraryStates(library);
  return entriesIn(library, folderId).filter((entry) => states.get(entry.item.id) === "active");
};

// Where every circle goes: the top level on the ring, then each folder in the
// open chain (outermost first) fanned out. `chain` is the part of `open` that
// is still showing.
export function layoutOrbit(library: Library, open: string[]): { placed: Placed[]; chain: string[] } {
  const ring = activeEntries(library, null);
  const placed: Placed[] = ring.map((entry, index) => {
    const angle = -90 + (index * 360) / ring.length;
    return { entry, parentId: null, angle, depth: 0, x: 50 + Math.cos(rad(angle)) * RING_R, y: 50 + Math.sin(rad(angle)) * RING_R };
  });
  const chain: string[] = [];
  let level = placed;
  for (const id of open) {
    const folder = level.find((node) => node.entry?.kind === "folder" && node.entry.item.id === id);
    if (!folder) break;
    chain.push(id);
    level = fan(folder, id, activeEntries(library, id));
    placed.push(...level);
  }
  return { placed, chain };
}

// Folder chain from the top level down to `folderId`, for opening it in place.
export function openChainTo(library: Library, folderId: string): string[] {
  const chain: string[] = [];
  for (let id: string | null = folderId, guard = 0; id && guard < 64; guard += 1) {
    chain.unshift(id);
    id = library.folders.find((folder) => folder.id === id)?.parentId ?? null;
  }
  return chain;
}

export const nodeKey = (node: Placed) => `${node.depth}:${node.entry?.item.id ?? `empty:${node.parentId}`}`;

// Inline position for a circle, plus the branch-out animation for fanned ones.
export function nodeStyle(node: Placed, index: number): CSSProperties {
  return { left: `${node.x}%`, top: `${node.y}%`, ...(node.from ? { "--from-x": `${node.from.x}%`, "--from-y": `${node.from.y}%`, animationDelay: `${(index % 8) * 30}ms` } : {}) } as CSSProperties;
}

interface StageProps {
  placed: Placed[];
  chain: string[];
  onOpenChange: (open: string[]) => void;
  center: ReactNode;
  decorations?: ReactNode;
  className?: string;
  worldRef?: Ref<HTMLDivElement>;
  children: ReactNode;
}

// The frame both orbits share: ring, center, dashed branches, and a world that
// slides (and shrinks if needed) to keep every open branch in view. Escape or a
// click on the background closes open folders.
export function OrbitStage({ placed, chain, onOpenChange, center, decorations, className = "", worldRef, children }: StageProps) {
  const outerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  // How wide the area around the stage is, in stage percent.
  const [size, setSize] = useState({ room: 100, stage: 0 });

  useLayoutEffect(() => {
    const measure = () => {
      const outer = outerRef.current?.clientWidth;
      const stage = stageRef.current?.clientWidth;
      if (outer && stage) setSize({ room: (outer / stage) * 100, stage });
    };
    measure();
    const observer = new ResizeObserver(measure);
    if (outerRef.current) observer.observe(outerRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!chain.length) return;
    const close = (event: KeyboardEvent) => { if (event.key === "Escape" && !document.querySelector("dialog[open]")) onOpenChange(chain.slice(0, -1)); };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  });

  // Fit the bounding box of every circle into the room around the stage.
  const radius = (node: Placed) => (node.depth ? CHILD_NODE_R : RING_NODE_R);
  const box = placed.reduce(
    (all, node) => ({ left: Math.min(all.left, node.x - radius(node)), right: Math.max(all.right, node.x + radius(node)), top: Math.min(all.top, node.y - radius(node)), bottom: Math.max(all.bottom, node.y + radius(node)) }),
    { left: 0, right: 100, top: 0, bottom: 100 },
  );
  const scale = Math.max(0.55, Math.min(1, (size.room - 4) / (box.right - box.left), 125 / (box.bottom - box.top)));
  const shiftX = -((box.left + box.right) / 2 - 50) * scale;
  const shiftY = -((box.top + box.bottom) / 2 - 50) * scale;
  const world = { transform: `translate(${shiftX}%, ${shiftY}%) scale(${scale})` } as CSSProperties;
  // Branches taller than the stage push the page apart instead of covering it.
  const spill = Math.max(0, ((box.bottom - box.top) * scale) / 2 - 50) / 100 * size.stage;

  return (
    <div ref={outerRef} className="orbit-spill flex w-full justify-center" style={{ marginBlock: spill }}>
      <div ref={stageRef} className={`subject-orbit-stage ${className}`}>
        <div ref={worldRef} className="orbit-world" style={world} onClick={(event) => { if (event.target === event.currentTarget && chain.length) onOpenChange([]); }}>
          <div className="subject-orbit-ring" aria-hidden="true" />
          {decorations}
          <svg className="orbit-branches" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            {placed.map((node) => node.from && <line key={nodeKey(node)} x1={node.from.x} y1={node.from.y} x2={node.x} y2={node.y} />)}
          </svg>
          <div className="subject-orbit-center">{center}</div>
          {children}
        </div>
      </div>
    </div>
  );
}

// Toggling the folder at `depth` of the chain closes it, or opens it in place
// of whatever was open at that depth.
export function toggleIn(chain: string[], depth: number, id: string): string[] {
  const kept = chain.slice(0, depth);
  return chain[depth] === id ? kept : [...kept, id];
}

interface Props {
  library: Library;
  // Chain of open folders, outermost first.
  open: string[];
  onOpenChange: (open: string[]) => void;
  center: ReactNode;
  decorations?: ReactNode;
}

// The main-page orbit outside Edit mode. Clicking a folder opens it in place:
// its subjects and folders branch out on dashed lines.
export default function OrbitView({ library, open, onOpenChange, center, decorations }: Props) {
  const { placed, chain } = layoutOrbit(library, open);
  return (
    <OrbitStage placed={placed} chain={chain} onOpenChange={onOpenChange} center={center} decorations={decorations}>
      {placed.map((node, index) => {
        const key = nodeKey(node);
        const style = nodeStyle(node, index);
        if (!node.entry) return <div key={key} className="orbit-empty" style={style}>Empty folder</div>;
        const expanded = node.entry.kind === "folder" && chain[node.depth] === node.entry.item.id;
        const place = { style, className: `${node.depth ? "orbit-child" : ""} ${expanded ? "orbit-open" : ""}`, expanded };
        if (node.entry.kind === "subject") return <SubjectNode key={key} subject={node.entry.item} place={place} />;
        const folder = node.entry.item;
        return <FolderNode key={key} folder={folder} count={activeEntries(library, folder.id).length} place={place} onOpen={() => onOpenChange(toggleIn(chain, node.depth, folder.id))} />;
      })}
    </OrbitStage>
  );
}
