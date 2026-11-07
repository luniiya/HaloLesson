import { useEffect, useRef } from "react";

// The book is real 3D (WebGL, see ./book3d), so it stays solid while it turns.
// The base and halo are flat Duolingo-style shapes. Sizes are in cqw of the
// artwork's width.
function BookModel() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let scene: { dispose(): void } | undefined;
    let cancelled = false;
    import("./book3d").then(({ mountBook }) => {
      if (cancelled || !ref.current) return;
      try {
        scene = mountBook(ref.current);
      } catch {} // no WebGL: the base and halo still show
    });
    return () => {
      cancelled = true;
      scene?.dispose();
    };
  }, []);
  return <div ref={ref} className="book3d-scene" />;
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
        <BookModel />
      </div>
    </div>
  );
}
