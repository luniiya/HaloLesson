import type { CSSProperties } from "react";
import type { Skill, SubjectDetail } from "@halolesson/shared";
import { IconSparkles } from "@tabler/icons-react";
import { mixColors } from "$lib/colors";
import SkillNode from "./SkillNode";

// Duolingo-style gentle wave: out to one side, back through the middle, out to the other.
const pathPositions = [50, 61, 67, 61, 50, 39, 33, 39];

export default function SkillPath({ detail, onSelect }: { detail: SubjectDetail; onSelect: (skill: Skill) => void }) {
  const { gradientStart, gradientEnd } = detail.subject;
  const totalSkills = detail.units.reduce((total, unit) => total + unit.skills.length, 0);
  return (
    <div className="mt-8 space-y-10">
      {detail.units.map((unit, unitIndex) => {
        const offset = detail.units.slice(0, unitIndex).reduce((total, item) => total + item.skills.length, 0);
        return (
          <section key={unit.id} aria-labelledby={`unit-${unit.id}`}>
            <header className="unit-banner" style={{ "--unit": `linear-gradient(115deg, ${gradientStart}, ${gradientEnd})`, "--unit-dark": mixColors(gradientEnd, "#000000", 0.25) } as CSSProperties}>
              <div>
                <p className="text-xs font-black uppercase tracking-wider opacity-80">Unit {unit.position + 1}</p>
                <h2 id={`unit-${unit.id}`} className="mt-0.5 text-xl font-black">{unit.title}</h2>
                <p className="mt-1 text-sm font-bold opacity-90">{unit.description}</p>
              </div>
              <span className="grid size-11 shrink-0 place-items-center rounded-xl border-2 border-white/35 bg-white/15" aria-hidden="true"><IconSparkles size={22} /></span>
            </header>
            <ol className="skill-path">
              {unit.skills.map((skill, index) => {
                const progress = totalSkills <= 1 ? 0 : (offset + index) / (totalSkills - 1);
                const base = mixColors(gradientStart, gradientEnd, progress);
                const palette: [string, string] = [base, mixColors(base, "#000000", 0.25)];
                return (
                  <li key={skill.id} className="skill-path-item" style={{ "--node-x": `${pathPositions[index % pathPositions.length]}%` } as CSSProperties}>
                    <SkillNode skill={skill} palette={palette} onSelect={onSelect} />
                  </li>
                );
              })}
            </ol>
          </section>
        );
      })}
    </div>
  );
}
