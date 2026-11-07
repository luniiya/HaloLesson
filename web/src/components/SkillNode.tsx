import type { CSSProperties } from "react";
import type { Skill } from "@halolesson/shared";
import { IconBarbell, IconBookmark, IconBook2, IconCheck, IconFlag3Filled, IconLock, IconStar, IconStarFilled } from "@tabler/icons-react";

function SkillIcon({ position, gold, locked }: { position: number; gold: boolean; locked: boolean }) {
  if (locked) return <IconLock size={36} stroke={2.4} aria-hidden="true" />;
  if (gold) return <IconStar size={40} stroke={2.5} aria-hidden="true" />;
  switch (position % 4) {
    case 0: return <IconBook2 size={40} stroke={2.2} aria-hidden="true" />;
    case 1: return <IconCheck size={40} stroke={2.5} aria-hidden="true" />;
    case 2: return <IconBookmark size={40} stroke={2.2} aria-hidden="true" />;
    default: return <IconBarbell size={40} stroke={2.2} aria-hidden="true" />;
  }
}

export default function SkillNode({ skill, palette, onSelect, className = "skill-node", style, pressed }: {
  skill: Skill;
  palette: [string, string];
  onSelect: (skill: Skill) => void;
  className?: string;
  style?: CSSProperties;
  pressed?: boolean;
}) {
  const gold = skill.stars === 3;
  const [base, dark] = skill.locked ? ["var(--color-swan)", "var(--color-hare)"] : gold ? ["#ffc800", "#d99a00"] : palette;
  const state = skill.locked ? "locked" : `${skill.stars} of 3 stars, ${Math.round(skill.mastery * 100)} percent mastery`;
  return (
    <button type="button" className={`level ${className} ${skill.locked ? "skill-node-locked" : ""}`} style={{ "--level": base, "--level-dark": dark, "--progress": `${Math.round(skill.mastery * 100)}%`, ...style } as CSSProperties} onClick={() => onSelect(skill)} aria-pressed={pressed} aria-label={`${skill.title}${skill.start ? ", start" : ""}, ${state}`}>
      {skill.start && <span className="skill-start" aria-hidden="true"><IconFlag3Filled size={13} />Start</span>}
      <span className="level-ring">
        <span className="level-button">
          <span className="level-ledge" />
          <span className="level-face"><SkillIcon position={skill.position} gold={gold} locked={skill.locked} /></span>
        </span>
      </span>
      <span className="skill-stars" aria-hidden="true">
        {[0, 1, 2].map((star) => <IconStarFilled key={star} size={18} className={star < skill.stars ? "skill-star-earned" : ""} />)}
      </span>
      <span className="skill-node-title">{skill.title}</span>
    </button>
  );
}
