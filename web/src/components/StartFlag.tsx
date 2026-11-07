import type { CSSProperties } from "react";

// The subject's start flag, a node of the map like the skills: it links to the
// start skills. Drawn flat like the halo: each part sits on a darker copy of
// itself (its ledge) and has a white shine, all in the subject's color. The
// viewBox is centred on the pole, whose foot is the flag's point on the map.
export default function StartFlag({ color, dark, pressed, linked, onSelect, style }: {
  color: string;
  dark: string;
  pressed: boolean;
  // Linked to the selected skill, shown while linking.
  linked: boolean;
  onSelect: () => void;
  style?: CSSProperties;
}) {
  return (
    <button type="button" className={`start-flag map-node ${linked ? "start-flag-linked" : ""}`} style={style} onClick={onSelect} aria-pressed={pressed} aria-label="Start flag">
      <svg viewBox="-14.5 0 100 150" aria-hidden="true">
        <ellipse className="start-flag-ring" cx="35.5" cy="140" rx="22" ry="7" />
        <rect x="31" y="12" width="9" height="128" rx="4.5" fill="#9aa6b1" />
        <rect x="31" y="12" width="6" height="128" rx="3" fill="#cfd6dd" />
        <g className="start-flag-cloth">
          <path d="M 39 22 C 52 14 64 30 86 22 L 86 60 C 64 68 52 52 39 60 Z" fill={dark} />
          <path d="M 39 16 C 52 8 64 24 86 16 L 86 54 C 64 62 52 46 39 54 Z" fill={color} />
          <path d="M 46 20.5 C 54 16 61 24 72 22.5" fill="none" stroke="#fff" strokeOpacity="0.55" strokeWidth="3.4" strokeLinecap="round" />
          <path d="M 77 21.4 L 80.5 20.6" fill="none" stroke="#fff" strokeOpacity="0.55" strokeWidth="3.4" strokeLinecap="round" />
        </g>
        <circle cx="35.5" cy="12.5" r="6.5" fill="#d99a00" />
        <circle cx="35.5" cy="10.5" r="6.5" fill="#ffc800" />
        <path d="M 32.4 8.6 A 3.6 3.6 0 0 1 36 6.9" fill="none" stroke="#fff" strokeOpacity="0.7" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
      <span className="skill-node-title">Start</span>
    </button>
  );
}
