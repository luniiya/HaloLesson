import { useEffect, useState } from "react";
import { Link } from "react-router";
import { IconCheck, IconHeartFilled, IconLock, IconX } from "@tabler/icons-react";
import { TIER_LABELS, TIERS, type Skill, type SkillInsight, type Tier } from "@halolesson/shared";
import { api } from "$lib/api";
import { progressLabel } from "./SkillNode";

// The card under the map for the selected skill: its four tiers (cleared ones
// can be replayed, the next one is open, later ones wait), the session
// settings and the concepts the learner struggles with most.
export default function SkillPreview({ skill, unlockTier, onClose }: { skill: Skill; unlockTier: Tier; onClose: () => void }) {
  const [insight, setInsight] = useState<SkillInsight | null>(null);
  useEffect(() => {
    let active = true;
    setInsight(null);
    api<SkillInsight>(`/api/skills/${skill.id}/insight`).then((data) => { if (active) setInsight(data); }).catch(() => undefined);
    return () => { active = false; };
  }, [skill.id, skill.tiersCleared, skill.mastery]);

  const open = Math.min(skill.tiersCleared, TIERS.length - 1);
  const next = TIERS[open]!;
  const struggles = insight?.concepts.filter((concept) => concept.wrong > 0).slice(0, 3) ?? [];

  return (
    <section className="skill-preview map-preview" aria-live="polite">
      <div className="min-w-0 flex-1">
        <p className="text-xs font-black uppercase tracking-wider text-accent-deep">{skill.locked ? "Locked skill" : progressLabel(skill)}</p>
        <h2 className="mt-1 text-lg font-black">{skill.title}</h2>
        <p className="mt-1 text-sm font-semibold text-wolf">
          {skill.locked ? `Clear ${TIER_LABELS[unlockTier]} on a skill linked to this one to open it.` : skill.description || "Practice this skill whenever you want to strengthen it."}
        </p>
        {!skill.locked && (
          <>
            <ul className="skill-tiers" aria-label="Tiers">
              {TIERS.map((tier, index) => {
                const cleared = index < skill.tiersCleared;
                const reachable = index <= open;
                const empty = skill.tierCounts[index] === 0;
                const label = `${TIER_LABELS[tier]}${cleared ? ", cleared" : reachable ? "" : ", locked"}${empty ? ", no exercises yet" : ""}`;
                return (
                  <li key={tier}>
                    {reachable && !empty ? (
                      <Link to={`/skills/${skill.id}/practice?tier=${tier}`} className={`skill-tier ${cleared ? "skill-tier-cleared" : "skill-tier-next"}`} aria-label={label}>
                        {cleared && <IconCheck size={14} stroke={3} aria-hidden="true" />}{TIER_LABELS[tier]}
                      </Link>
                    ) : (
                      <span className="skill-tier skill-tier-closed" aria-label={label} title={empty ? "No exercises yet" : `Clear ${TIER_LABELS[TIERS[index - 1]!]} first`}>
                        {!reachable && <IconLock size={13} aria-hidden="true" />}{TIER_LABELS[tier]}
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
            <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
              {skill.tierCounts[open]
                ? <Link to={`/skills/${skill.id}/practice?tier=${next}`} className="button button-primary">{skill.tiersCleared >= TIERS.length ? "Replay Expert" : `Practice ${TIER_LABELS[next]}`}</Link>
                : <span className="text-sm font-bold text-wolf">{TIER_LABELS[next]} has no exercises yet. Ask an agent to write some.</span>}
              <span className="flex items-center gap-1 text-xs font-extrabold uppercase text-wolf">
                {skill.sessionSize} questions · <IconHeartFilled size={14} className="text-cardinal" aria-hidden="true" />{skill.hearts}
              </span>
            </div>
            {struggles.length > 0 && (
              <div className="mt-4">
                <p className="text-xs font-black uppercase tracking-wider text-wolf">Struggling with</p>
                <ul className="mt-1.5 flex flex-wrap gap-2">
                  {struggles.map((concept) => (
                    <li key={concept.concept} className="rounded-xl bg-red-50 px-3 py-1 text-xs font-extrabold text-cardinal" title={`${concept.wrong} wrong of ${concept.answered}`}>
                      {concept.concept} · {Math.round(concept.failRate * 100)}% missed
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
        {skill.locked && <span className="button button-secondary mt-4 gap-2 opacity-70" aria-disabled="true"><IconLock size={18} />Locked</span>}
      </div>
      <button type="button" onClick={onClose} className="absolute right-3 top-2 rounded-lg p-2 text-wolf hover:bg-eel hover:text-ink" aria-label="Close skill preview"><IconX size={18} /></button>
    </section>
  );
}
