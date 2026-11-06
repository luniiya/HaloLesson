import type { ReactNode } from "react";

// The book is real CSS 3D: every part is a solid slab so it keeps its
// thickness while it turns. The base and halo are flat Duolingo-style shapes.
// Sizes are in cqw of the artwork's width.
type Faces = Record<"front" | "back", string>;

// A rounded box is filled with thin rounded slices through its depth so it
// stays solid at the corners from any angle; `edge` classes alternate per
// slice (stacked paper).
function Box({ w, h, d, x = 0, z = 0, round = 0, faces, edge, children }: { w: number; h: number; d: number; x?: number; z?: number; round?: number; faces: Faces; edge: string[]; children?: ReactNode }) {
  const face = (name: keyof Faces, transform: string, content?: ReactNode) => (
    <div className={`book3d-face ${faces[name]}`} style={{ borderRadius: `${round}cqw`, transform }}>{content}</div>
  );
  const slices = Math.max(2, Math.round(d / 0.3));
  return (
    <div className="book3d-box" style={{ width: `${w}cqw`, height: `${h}cqw`, left: `${-w / 2}cqw`, top: `${-h / 2}cqw`, transform: `translate3d(${x}cqw, 0, ${z}cqw)` }}>
      {face("front", `translateZ(${d / 2}cqw)`, children)}
      {face("back", `rotateY(180deg) translateZ(${d / 2}cqw)`)}
      {Array.from({ length: slices - 1 }, (_, index) => (
        <div key={index} className={`book3d-slice ${edge[index % edge.length]}`}
          style={{ borderRadius: `${round}cqw`, transform: `translateZ(${-d / 2 + d * (index + 1) / slices}cqw)` }} />
      ))}
    </div>
  );
}

const COVER = { w: 22, h: 28, d: 1.8 };
const PAGES = { w: 20, h: 25.4, d: 3 };
const COVER_FACES = { front: "book3d-cover-inside", back: "book3d-cover" };
const COVER_EDGE = ["book3d-cover-edge"];
const SPINE_FACES = { front: "book3d-cover-edge", back: "book3d-spine" };
const PAGE_FACES = { front: "book3d-page", back: "book3d-page" };
const PAGE_EDGE = ["book3d-paper", "book3d-paper-shade"];

// One half of the open book, hinged on the spine. side = -1 (left) or 1 (right).
function BookHalf({ side }: { side: -1 | 1 }) {
  return (
    <div className="book3d-group" style={{ transform: `rotateY(${side * -24}deg)` }}>
      <Box w={COVER.w} h={COVER.h} d={COVER.d} x={side * COVER.w / 2} z={-COVER.d / 2} round={4} faces={COVER_FACES} edge={COVER_EDGE} />
      <Box w={PAGES.w} h={PAGES.h} d={PAGES.d} x={side * (PAGES.w / 2 + 0.4)} z={PAGES.d / 2} round={3} faces={PAGE_FACES} edge={PAGE_EDGE}>
        <span className="page-title" />
        <span className="page-line line-one" />
        <span className="page-line line-two" />
        <span className="page-line line-three" />
        <span className="page-diagram" />
        {side === 1 && <span className="page-ribbon" />}
      </Box>
    </div>
  );
}

// Two-tone ring with a solid ledge underneath and a rounded shine on top.
function Halo() {
  return (
    <svg className="book-halo" viewBox="0 0 100 34" aria-hidden="true">
      <ellipse cx="50" cy="19" rx="40" ry="11" fill="none" stroke="#e5ad00" strokeWidth="8" />
      <ellipse cx="50" cy="15" rx="40" ry="11" fill="none" stroke="#ffc800" strokeWidth="8" />
      <path d="M 14.5 10.8 A 40 11 0 0 1 61 2.7" fill="none" stroke="#fff" strokeOpacity="0.55" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M 69 3.8 A 40 11 0 0 1 77 5.6" fill="none" stroke="#fff" strokeOpacity="0.55" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}

export default function BookArtwork({ className = "" }: { className?: string }) {
  return (
    <div className={`book-artwork ${className}`} role="img" aria-label="An open book floating and turning above a level button, under a golden halo">
      <span className="book-spark book-spark-one" />
      <span className="book-spark book-spark-two" />
      <div className="book-base">
        <div className="book-base-button">
          <span className="book-base-ledge" />
          <div className="book-base-face"><span className="book-base-shadow" /></div>
        </div>
      </div>
      <div className="book-float">
        <Halo />
        <div className="book3d-scene">
          <div className="book3d-camera">
            <div className="book3d-spin">
              <div className="book3d-tilt">
                <BookHalf side={-1} />
                <BookHalf side={1} />
                <Box w={3} h={COVER.h - 3} d={1.8} z={-COVER.d - 0.7} round={1.5} faces={SPINE_FACES} edge={COVER_EDGE} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
