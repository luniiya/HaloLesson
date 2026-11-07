import type { CSSProperties } from "react";
import { TIER_LABELS, TIERS, type Medal, type Skill } from "@halolesson/shared";
import { IconBarbell, IconBookmark, IconBook2, IconCheck, IconFlag3Filled, IconLock, IconStar } from "@tabler/icons-react";
import { Ring, type RingArc } from "./SubjectNode";

// Face and ledge colors of a skill that cleared Expert. The medal fades from
// gold to silver to copper when Expert isn't cleared again (see medalFor).
export const MEDAL_COLORS: Record<Medal, [string, string]> = {
  gold: ["#ffc800", "#d99a00"],
  silver: ["#c4ced8", "#8d99a6"],
  copper: ["#e08a4c", "#a8592a"],
};

function SkillIcon({ position, medal, locked }: { position: number; medal: boolean; locked: boolean }) {
  if (locked) return <IconLock size={36} stroke={2.4} aria-hidden="true" />;
  if (medal) return <IconStar size={40} stroke={2.5} aria-hidden="true" />;
  switch (position % 4) {
    case 0: return <IconBook2 size={40} stroke={2.2} aria-hidden="true" />;
    case 1: return <IconCheck size={40} stroke={2.5} aria-hidden="true" />;
    case 2: return <IconBookmark size={40} stroke={2.2} aria-hidden="true" />;
    default: return <IconBarbell size={40} stroke={2.2} aria-hidden="true" />;
  }
}

// The ring shows the tiers below Expert in three segments, like a tracker's
// level: 1/3 Easy cleared, 2/3 Medium, 3/3 Hard. A medal fills it whole.
const GAP = 7;
function tierRing(skill: Skill): RingArc[] {
  if (skill.medal) return [{ from: 0, to: 360, tone: "fill" }];
  return [0, 1, 2].map((segment) => ({ from: segment * 120 + GAP, to: (segment + 1) * 120 - GAP, tone: segment < skill.tiersCleared ? "gold" : "track" }));
}

export function progressLabel(skill: Pick<Skill, "tiersCleared" | "medal">): string {
  if (skill.medal) return `${skill.medal[0]!.toUpperCase()}${skill.medal.slice(1)}`;
  return skill.tiersCleared === 0 ? "Not started" : `${TIER_LABELS[TIERS[skill.tiersCleared - 1]!]} cleared`;
}

export default function SkillNode({ skill, palette, onSelect, className = "skill-node", style, pressed }: {
  skill: Skill;
  palette: [string, string];
  onSelect: (skill: Skill) => void;
  className?: string;
  style?: CSSProperties;
  pressed?: boolean;
}) {
  const [base, dark] = skill.locked ? ["var(--color-swan)", "var(--color-hare)"] : skill.medal ? MEDAL_COLORS[skill.medal] : palette;
  const state = skill.locked ? "locked" : progressLabel(skill);
  return (
    <button type="button" className={`level ${className} ${skill.locked ? "skill-node-locked" : ""}`} style={{ "--level": base, "--level-dark": dark, ...style } as CSSProperties} onClick={() => onSelect(skill)} aria-pressed={pressed} aria-label={`${skill.title}${skill.start ? ", start" : ""}, ${state}`}>
      {skill.start && <span className="skill-start" aria-hidden="true"><IconFlag3Filled size={13} />Start</span>}
      <span className="level-ring level-ring-custom">
        <Ring arcs={tierRing(skill)} />
        <span className="level-button">
          <span className="level-ledge" />
          <span className="level-face"><SkillIcon position={skill.position} medal={Boolean(skill.medal)} locked={skill.locked} /></span>
        </span>
      </span>
      <span className="skill-node-title">{skill.title}</span>
    </button>
  );
}
