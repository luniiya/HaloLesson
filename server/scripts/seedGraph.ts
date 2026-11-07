// Dev tool: fills an account with a test subject to try the skill map.
// By default it's a small map of mathematics (real skills and prerequisite
// links); --random N makes N random skills instead, to stress the layout.
// Every skill gets arithmetic exercises in all four tiers so practice (and unlocking) works.
//
//   bun run seed:graph <username> [--random N] [--unlock]
import { db } from "../src/db";
import { createRegion, createSkill, linkSkills } from "../src/skillGraph";
import { createSubject } from "../src/subjects";
import { TIERS } from "@halolesson/shared";
import { MATHS_MAP } from "./mathsMap";

const argv = process.argv.slice(2);
const username = argv.find((arg, index) => !arg.startsWith("--") && argv[index - 1] !== "--random");
const unlock = argv.includes("--unlock");
const randomAt = argv.indexOf("--random");
const count = randomAt === -1 ? 0 : Math.min(Math.max(Number(argv[randomAt + 1]) || 40, 1), 1000);
if (!username) {
  console.error("Usage: bun run seed:graph <username> [--random N] [--unlock]");
  process.exit(1);
}
const user = db.query<{ id: string }, [string]>("SELECT id FROM users WHERE username = ? COLLATE NOCASE").get(username);
if (!user) {
  console.error(`No user named ${username}`);
  process.exit(1);
}

// Every skill gets a pool in all four tiers (the rule for real skills too), each
// with a concept tag so the recommender and insight have something to track.
// Harder tiers use bigger numbers, and Expert switches to multiplication.
const TIER_RANGES = [10, 40, 400, 99] as const;
const EXERCISES_PER_TIER = 8;

function addExercises(skillId: string) {
  const now = new Date().toISOString();
  const insert = db.prepare("INSERT INTO exercises (id, skill_id, type, prompt, content_json, explanation, tier, concepts_json, position, created_at) VALUES (?, ?, 'multiple_choice', ?, ?, ?, ?, ?, ?, ?)");
  db.transaction(() => {
    TIERS.forEach((_, tier) => {
      const times = tier === 3;
      for (let exercise = 0; exercise < EXERCISES_PER_TIER; exercise += 1) {
        const a = 2 + Math.floor(Math.random() * TIER_RANGES[tier]!);
        const b = 2 + Math.floor(Math.random() * TIER_RANGES[tier]!);
        const answer = times ? a * b : a + b;
        const options = [answer + 1, answer - 1, times ? a + b : a * b].map(String);
        const correctIndex = Math.floor(Math.random() * 4);
        options.splice(correctIndex, 0, String(answer));
        const sign = times ? "×" : "+";
        insert.run(
          crypto.randomUUID(), skillId, `What is ${a} ${sign} ${b}?`, JSON.stringify({ options, correctIndex }), `${a} ${sign} ${b} = ${answer}.`,
          tier, JSON.stringify([times ? "multiplication" : "addition"]), tier * EXERCISES_PER_TIER + exercise, now,
        );
      }
    });
  })();
}

if (!count) {
  const subject = createSubject(user.id, "Map of Mathematics", "A test map: real skills linked to what they build on", "purple", "#ce82ff", "#1cb0f6", { unlockInOrder: unlock });
  const ids = new Map<string, string>();
  for (const { region, skills } of MATHS_MAP) {
    const unitId = createRegion(user.id, subject.id, { title: region }).id;
    for (const [title] of skills) {
      const { id } = createSkill(user.id, subject.id, { title, unitId, start: title === "Counting" });
      ids.set(title, id);
      addExercises(id);
    }
  }
  let links = 0;
  for (const [title, buildsOn] of MATHS_MAP.flatMap((region) => region.skills)) {
    for (const other of buildsOn) {
      linkSkills(user.id, ids.get(title)!, ids.get(other)!);
      links += 1;
    }
  }
  console.log(`Created "${subject.name}" with ${ids.size} skills, ${links} links and ${MATHS_MAP.length} regions${unlock ? ", unlocking in order" : ""}: /subjects/${subject.id}`);
  process.exit(0);
}

const REGIONS = ["Foundations", "Number Systems", "Structures", "Spaces", "Changes", "Applied", "Computation", "Probability"];
const FIRST = ["Linear", "Abstract", "Complex", "Discrete", "Applied", "Numerical", "Basic", "Advanced", "Modular", "Vector", "Partial", "Formal"];
const SECOND = ["Algebra", "Geometry", "Analysis", "Logic", "Topology", "Sets", "Graphs", "Fractions", "Equations", "Matrices", "Limits", "Proofs", "Series", "Groups", "Integrals"];
const pick = <T>(items: T[]) => items[Math.floor(Math.random() * items.length)]!;

const subject = createSubject(user.id, `Test map ${new Date().toISOString().slice(11, 19)}`, `${count} random skills to try the skill map`, "purple", "#ce82ff", "#1cb0f6", { unlockInOrder: unlock });
const regionCount = Math.min(REGIONS.length, Math.max(1, Math.round(count / 12)));
const regions = REGIONS.slice(0, regionCount).map((title) => createRegion(user.id, subject.id, { title }).id);

const skills: Array<{ id: string; region: number }> = [];
const used = new Set<string>();
for (let index = 0; index < count; index += 1) {
  const region = index < regionCount ? index : Math.floor(Math.random() * regionCount);
  let title = `${pick(FIRST)} ${pick(SECOND)}`;
  for (let n = 2; used.has(title); n += 1) title = `${title.replace(/ \d+$/, "")} ${n}`;
  used.add(title);
  // Shaped like a real subject: each region grows as a tree from its first
  // skill (each skill builds on one recent skill of its region, now and then
  // two), and only a few links cross into the neighbouring region.
  const sameRegion = skills.filter((skill) => skill.region === region);
  const recent = sameRegion.slice(-6);
  const linkTo = new Set<string>();
  if (recent.length) linkTo.add(pick(recent).id);
  if (recent.length > 2 && Math.random() < 0.12) linkTo.add(pick(recent).id);
  const next = skills.filter((skill) => skill.region === (region + 1) % regionCount);
  if (next.length && (sameRegion.length === 0 ? region > 0 : Math.random() < 0.03)) linkTo.add(pick(next.slice(0, 4)).id);
  const { id } = createSkill(user.id, subject.id, { title, unitId: regions[region], linkTo: [...linkTo], start: index === 0 });
  skills.push({ id, region });
  addExercises(id);
}
console.log(`Created "${subject.name}" with ${count} skills in ${regionCount} regions${unlock ? ", unlocking in order" : ""}: /subjects/${subject.id}`);
