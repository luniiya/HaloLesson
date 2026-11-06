import { useEffect, useRef, useState, type CSSProperties, type MouseEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { flushSync } from "react-dom";
import { Link, useNavigate } from "react-router";
import { IconCheck, IconFolder, IconMinus, IconPlus, IconStarFilled } from "@tabler/icons-react";
import type { ItemKind, Library, Subject } from "@halolesson/shared";
import { entriesIn, entryParent, libraryApi, type Entry } from "$lib/library";
import { iconFor } from "$lib/subjectIcons";
import { OrbitStage, activeEntries, layoutOrbit, nodeKey, nodeStyle, openChainTo, toggleIn, type Placed } from "./OrbitView";
import { OrbitFace, folderColors, folderMeta, subjectColors, subjectMeta, subjectRing } from "./SubjectNode";

// Anything carrying data-drop="archive" | "trash" | "folder:<id>" | "folder:"
// (the top level) accepts a dragged item, wherever it is on the page: folder
// circles and empty-folder markers here, and the sidebar's Archive and Trash.
export type DropTarget = { kind: "archive" } | { kind: "trash" } | { kind: "folder"; id: string | null } | { kind: "slot"; node: Placed };

const DRAG_THRESHOLD = 6;
// How close (stage percent) the pointer must be to a circle to take its slot.
const SLOT_REACH = 20;

function parseDrop(value: string | undefined): DropTarget | null {
  if (value === "archive" || value === "trash") return { kind: value };
  if (value?.startsWith("folder:")) return { kind: "folder", id: value.slice(7) || null };
  return null;
}

// The index moveItem wants for taking `target`'s slot: counted among all of
// its siblings (archived ones too, as the server does), after `id` is lifted out.
function slotIndex(library: Library, id: string, parentId: string | null, targetId: string): number {
  const siblings = entriesIn(library, parentId);
  const from = siblings.findIndex((entry) => entry.item.id === id);
  const to = siblings.findIndex((entry) => entry.item.id === targetId);
  const without = siblings.filter((entry) => entry.item.id !== id).findIndex((entry) => entry.item.id === targetId);
  return from !== -1 && from < to ? without + 1 : without;
}

// The library as it will look once a move lands, so the circles don't jump
// back while the server catches up.
function movedLocally(library: Library, kind: ItemKind, id: string, parentId: string | null, index?: number): Library {
  const order = entriesIn(library, parentId).map((entry) => entry.item.id).filter((other) => other !== id);
  order.splice(index ?? order.length, 0, id);
  const place = <T extends { id: string; position: number }>(item: T, parentKey: "parentId" | "folderId", isKind: boolean): T => {
    const position = order.indexOf(item.id);
    if (isKind && item.id === id) return { ...item, [parentKey]: parentId, position } as T;
    return position === -1 ? item : { ...item, position };
  };
  return {
    ...library,
    folders: library.folders.map((folder) => place(folder, "parentId", kind === "folder")),
    subjects: library.subjects.map((subject) => place(subject, "folderId", kind === "subject")),
  };
}

interface Drag {
  entry: Entry;
  pointerId: number;
  startX: number;
  startY: number;
  moved: boolean;
  // Pointer position in stage percent, for the circle that follows it.
  x: number;
  y: number;
  target: DropTarget | null;
  hovered: Element | null;
}

interface Props {
  library: Library;
  // Chain of open folders, outermost first.
  open: string[];
  onOpenChange: (open: string[]) => void;
  editing: boolean;
  center: ReactNode;
  decorations?: ReactNode;
  onEdit: (entry: Entry) => void;
  // Edit mode's level pill on a subject or tracker.
  onRate: (subject: Subject) => void;
  onChanged: () => void;
  onError: (message: string) => void;
}

// The main-page orbit. Outside Edit mode a subject opens its path and a folder
// opens in place, its contents branching out on dashed lines. In Edit mode the
// circles wiggle: click one to customize it, drag one onto another's slot to
// reorder (or move it to that circle's folder), onto a folder to move it in, or
// onto Archive/Trash to put it away; folders open with their +/- button.
// Both modes are this one component so toggling Edit never rebuilds the orbit.
export default function LibraryOrbit({ library, open, onOpenChange, editing, center, decorations, onEdit, onRate, onChanged, onError }: Props) {
  const navigate = useNavigate();
  const worldRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<Drag | null>(null);
  const suppressClick = useRef(false);
  const [drag, setDrag] = useState<Drag | null>(null);
  // Optimistic result of the last drop, kept until the refetched library arrives.
  const [pending, setPending] = useState<Library | null>(null);
  useEffect(() => setPending(null), [library]);

  const shown = pending ?? library;
  // Circles stay put while dragging (shifting them would slide folders away
  // from the pointer); the circle whose slot would be taken is highlighted.
  const { placed, chain } = layoutOrbit(shown, open);
  const slotId = drag?.moved && drag.target?.kind === "slot" ? drag.target.node.entry?.item.id : null;
  // Window listeners outlive the render that added them, so they read this.
  const latest = useRef({ placed, drop });
  latest.current = { placed, drop };

  function locate(entry: Entry, clientX: number, clientY: number): Pick<Drag, "x" | "y" | "target" | "hovered"> {
    const rect = worldRef.current!.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * 100;
    const y = ((clientY - rect.top) / rect.height) * 100;
    const hovered = document.elementFromPoint(clientX, clientY)?.closest("[data-drop]") ?? null;
    const dropped = parseDrop(hovered?.getAttribute("data-drop") ?? undefined);
    if (dropped) return { x, y, target: dropped, hovered };
    // Otherwise the nearest circle's slot (its own spot means "leave it").
    let nearest: Placed | null = null;
    let best = SLOT_REACH;
    for (const node of latest.current.placed) {
      const distance = Math.hypot(node.x - x, node.y - y);
      if (node.entry && distance < best) { nearest = node; best = distance; }
    }
    const intoItself = entry.kind === "folder" && nearest?.parentId && openChainTo(library, nearest.parentId).includes(entry.item.id);
    const target = nearest && nearest.entry?.item.id !== entry.item.id && !intoItself ? { kind: "slot" as const, node: nearest } : null;
    return { x, y, target, hovered: null };
  }

  function start(event: ReactPointerEvent, entry: Entry) {
    if (event.button !== 0 || dragRef.current) return;
    dragRef.current = { entry, pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, moved: false, x: 0, y: 0, target: null, hovered: null };

    const move = (event: PointerEvent) => {
      const current = dragRef.current;
      if (!current || event.pointerId !== current.pointerId) return;
      if (!current.moved && Math.hypot(event.clientX - current.startX, event.clientY - current.startY) < DRAG_THRESHOLD) return;
      if (!current.moved) document.body.classList.add("library-dragging");
      const next = { ...current, moved: true, ...locate(current.entry, event.clientX, event.clientY) };
      if (next.hovered !== current.hovered) {
        current.hovered?.classList.remove("drop-hover");
        next.hovered?.classList.add("drop-hover");
      }
      dragRef.current = next;
      setDrag(next);
    };
    const stop = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", stop);
      document.body.classList.remove("library-dragging");
      const current = dragRef.current;
      current?.hovered?.classList.remove("drop-hover");
      dragRef.current = null;
      setDrag(null);
      return current;
    };
    const end = (event: PointerEvent) => {
      if (dragRef.current?.pointerId !== event.pointerId) return;
      const current = stop();
      if (!current?.moved) return;
      // The click that follows a drag must not open the editor.
      suppressClick.current = true;
      setTimeout(() => { suppressClick.current = false; }, 0);
      if (current.target) void latest.current.drop(current.entry, current.target);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", stop);
  }

  function openSubject(event: MouseEvent<HTMLAnchorElement>, to: string) {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!document.startViewTransition || reducedMotion) return;
    event.preventDefault();
    document.startViewTransition(() => flushSync(() => navigate(to)));
  }

  async function drop(entry: Entry, target: DropTarget) {
    const { kind, item } = entry;
    let action: () => Promise<unknown>;
    if (target.kind === "slot") {
      const parentId = target.node.parentId;
      const index = slotIndex(shown, item.id, parentId, target.node.entry!.item.id);
      setPending(movedLocally(shown, kind, item.id, parentId, index));
      action = () => libraryApi.move(kind, item.id, parentId, index);
    } else if (target.kind === "folder") {
      if (target.id === entryParent(entry) || target.id === item.id) return;
      setPending(movedLocally(shown, kind, item.id, target.id));
      action = () => libraryApi.move(kind, item.id, target.id);
    } else {
      setPending({ ...shown, folders: shown.folders.filter((folder) => folder.id !== item.id), subjects: shown.subjects.filter((subject) => subject.id !== item.id) });
      action = target.kind === "archive" ? () => libraryApi.archive(kind, item.id, true) : () => libraryApi.trash(kind, item.id);
    }
    try {
      await action();
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : "Something went wrong");
      setPending(null);
    }
    onChanged();
  }

  return (
    <OrbitStage placed={placed} chain={chain} onOpenChange={onOpenChange} center={center} decorations={decorations} worldRef={worldRef} className={drag?.moved ? "orbit-is-dragging" : ""}>
      {placed.map((node, index) => {
        const key = nodeKey(node);
        const entry = node.entry;
        if (!entry) return <div key={key} className="orbit-empty" style={nodeStyle(node, index)} data-drop={`folder:${node.parentId}`}>Empty folder</div>;
        const dragged = drag?.moved && drag.entry.item.id === entry.item.id;
        const isFolder = entry.kind === "folder";
        const expanded = isFolder && chain[node.depth] === entry.item.id;
        const { color, dark } = isFolder ? folderColors(entry.item) : subjectColors(entry.item);
        const ring = isFolder ? null : subjectRing(entry.item);
        const style = { ...nodeStyle(node, index), "--level": color, "--level-dark": dark, ...(dragged ? { left: `${drag.x}%`, top: `${drag.y}%` } : {}) } as CSSProperties;
        const count = isFolder ? activeEntries(shown, entry.item.id).length : 0;
        const meta = isFolder ? folderMeta(count) : subjectMeta(entry.item);
        const face = (
          <OrbitFace
            Symbol={isFolder ? IconFolder : iconFor(entry.item)}
            label={entry.item.name}
            meta={meta}
            drop={editing && isFolder && !dragged ? `folder:${entry.item.id}` : undefined}
            ring={ring ?? undefined}
          />
        );
        const toggle = () => onOpenChange(toggleIn(chain, node.depth, entry.item.id));
        return (
          <div
            key={key}
            className={`subject-node-position ${editing ? "orbit-editable" : ""} ${node.depth ? "orbit-child" : ""} ${expanded ? "orbit-open" : ""} ${dragged ? "orbit-dragged" : ""} ${slotId === entry.item.id && !dragged ? "orbit-slot-target" : ""}`}
            style={style}
            onPointerDown={editing ? (event) => start(event, entry) : undefined}
          >
            {editing ? (
              <button
                type="button"
                className="level subject-node group"
                aria-label={`Customize ${isFolder ? "folder " : ""}${entry.item.name}`}
                onClick={() => { if (!suppressClick.current) onEdit(entry); }}
              >
                {face}
              </button>
            ) : isFolder ? (
              <button type="button" className="level subject-node group" aria-label={`${expanded ? "Close" : "Open"} folder ${entry.item.name}, ${count} items`} aria-expanded={expanded} onClick={toggle}>
                {face}
              </button>
            ) : (
              <Link to={`/subjects/${entry.item.id}`} onClick={(event) => openSubject(event, `/subjects/${entry.item.id}`)} className="level subject-node group" aria-label={`Open ${entry.item.name}, ${meta}`}>
                {face}
              </Link>
            )}
            {editing && !isFolder && !dragged && (
              <button
                type="button"
                className={`orbit-level ${entry.item.level === null ? "orbit-level-unrated" : ""}`}
                aria-label={`Level of ${entry.item.name}: ${entry.item.level ?? "not rated"}. Change it`}
                onPointerDown={(event) => event.stopPropagation()}
                onClick={() => onRate(entry.item)}
              >
                <IconStarFilled size={12} aria-hidden="true" />{entry.item.level === null ? "Rate" : `Lv ${entry.item.level}`}
              </button>
            )}
            {editing && !isFolder && entry.item.type === "subject" && !dragged && (
              <span className="orbit-status" aria-label={`${entry.item.completedCount} of ${entry.item.skillCount} skills done`}>
                <IconCheck size={12} stroke={3.5} aria-hidden="true" />{entry.item.completedCount}/{entry.item.skillCount}
              </span>
            )}
            {editing && isFolder && !dragged && (
              <button
                type="button"
                className="orbit-expand"
                aria-label={`${expanded ? "Close" : "Open"} folder ${entry.item.name}`}
                aria-expanded={expanded}
                onPointerDown={(event) => event.stopPropagation()}
                onClick={toggle}
              >
                {expanded ? <IconMinus size={16} stroke={3} /> : <IconPlus size={16} stroke={3} />}
              </button>
            )}
          </div>
        );
      })}
    </OrbitStage>
  );
}
