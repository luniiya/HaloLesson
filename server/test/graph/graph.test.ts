import { describe, expect, test } from "bun:test";
import { MAP_SPACING, MAP_Y_SCALE } from "@halolesson/shared";
import { AgentError, commit, readSubject } from "../../src/agent/ops";
import { buildExport, importSubjects, parseImport } from "../../src/dataExport";
import { db } from "../../src/db";
import { readUpload, toHalolesson } from "../../src/halolessonFile";
import { getPracticeSession } from "../../src/practice";
import { computeLayout, createRegion, createSkill, DEFAULT_REGION_TITLE, deleteRegion, deleteSkill, linkSkills, unlinkSkills, updateSkill } from "../../src/skillGraph";
import { createSubject, getSubject, updateSubject } from "../../src/subjects";
import { makeUser } from "../helpers";

const run = (userId: string, command: Record<string, unknown>) => commit(userId, { command }).result as Record<string, unknown>;

function subjectFor(userId: string, name = "Maths") {
  return createSubject(userId, name, "", "purple", "#ce82ff", "#1cb0f6").id;
}

// A chain a - b - c, plus d linked to a.
function chain() {
  const user = makeUser();
  const subjectId = subjectFor(user.id);
  const a = createSkill(user.id, subjectId, { title: "Counting" }).id;
  const b = createSkill(user.id, subjectId, { title: "Adding", linkTo: [a] }).id;
  const c = createSkill(user.id, subjectId, { title: "Multiplying", linkTo: [b] }).id;
  const d = createSkill(user.id, subjectId, { title: "Shapes", linkTo: [a] }).id;
  return { user, subjectId, a, b, c, d };
}

const skillsOf = (userId: string, subjectId: string) => getSubject(userId, subjectId).units.flatMap((unit) => unit.skills);
const finish = (userId: string, skillId: string) =>
  db.run("INSERT OR REPLACE INTO skill_progress (user_id, skill_id, stars, mastery, correct_attempts, total_attempts) VALUES (?, ?, 1, 0.5, 3, 3)", [userId, skillId]);

describe("skills and regions", () => {
  test("a first skill makes a default region; linked skills join their neighbour's region", () => {
    const user = makeUser();
    const subjectId = subjectFor(user.id);
    const first = createSkill(user.id, subjectId, { title: "Counting" }).id;
    const other = createRegion(user.id, subjectId, { title: "Geometry" }).id;
    const shapes = createSkill(user.id, subjectId, { title: "Shapes", unitId: other }).id;
    const angles = createSkill(user.id, subjectId, { title: "Angles", linkTo: [shapes] }).id;
    const { units, links } = getSubject(user.id, subjectId);
    expect(units.map((unit) => unit.title)).toEqual([DEFAULT_REGION_TITLE, "Geometry"]);
    expect(units[0]!.skills.map((skill) => skill.id)).toEqual([first]);
    expect(units[1]!.skills.map((skill) => skill.id)).toEqual([shapes, angles]);
    expect(links).toEqual([[shapes, angles].sort() as [string, string]]);
  });

  test("edits, moves between regions and deletes", () => {
    const { user, subjectId, a, b } = chain();
    const region = createRegion(user.id, subjectId, { title: "Later" }).id;
    updateSkill(user.id, b, { title: "Addition", unitId: region, start: true });
    const moved = skillsOf(user.id, subjectId).find((skill) => skill.id === b)!;
    expect(moved).toMatchObject({ title: "Addition", unitId: region, start: true });
    deleteSkill(user.id, a);
    expect(getSubject(user.id, subjectId).links.some((link) => link.includes(a))).toBe(false);
    deleteRegion(user.id, region);
    expect(skillsOf(user.id, subjectId).some((skill) => skill.id === b)).toBe(false);
    expect(() => updateSkill(user.id, b, { title: "x" })).toThrow("Skill not found");
  });

  test("links have no direction, can't repeat, loop or cross subjects", () => {
    const { user, subjectId, a, b, c } = chain();
    linkSkills(user.id, b, a);
    expect(getSubject(user.id, subjectId).links).toHaveLength(3);
    expect(() => linkSkills(user.id, a, a)).toThrow("itself");
    const elsewhere = createSkill(user.id, subjectFor(user.id, "Other"), { title: "Far" }).id;
    expect(() => linkSkills(user.id, a, elsewhere)).toThrow("same subject");
    unlinkSkills(user.id, c, b);
    expect(getSubject(user.id, subjectId).links).toHaveLength(2);
    expect(() => createSkill(makeUser().id, subjectId, { title: "Nope" })).toThrow("Subject not found");
  });

  test("trackers have no skill map", () => {
    const user = makeUser();
    const tracker = createSubject(user.id, "Guitar", "", "green", "#58cc02", "#1cb0f6", { type: "tracker" }).id;
    expect(() => createSkill(user.id, tracker, { title: "Chords" })).toThrow("tracker");
  });
});

describe("layout", () => {
  test("every skill gets a spaced-out position, and reading again changes nothing", () => {
    const { user, subjectId } = chain();
    const skills = skillsOf(user.id, subjectId);
    for (const skill of skills) expect(Number.isFinite(skill.x) && Number.isFinite(skill.y)).toBe(true);
    for (const one of skills) {
      for (const two of skills) {
        if (one !== two) expect(Math.hypot(one.x! - two.x!, (one.y! - two.y!) * MAP_Y_SCALE)).toBeGreaterThanOrEqual(MAP_SPACING * 0.94);
      }
    }
    expect(skillsOf(user.id, subjectId)).toEqual(skills);
  });

  test("adding a skill nudges the map instead of reshuffling it", () => {
    const { user, subjectId, c } = chain();
    const before = new Map(skillsOf(user.id, subjectId).map((skill) => [skill.id, skill]));
    createSkill(user.id, subjectId, { title: "Dividing", linkTo: [c] });
    const after = skillsOf(user.id, subjectId).filter((skill) => before.has(skill.id));
    const moved = after.reduce((sum, skill) => sum + Math.hypot(skill.x! - before.get(skill.id)!.x!, skill.y! - before.get(skill.id)!.y!), 0) / after.length;
    expect(moved).toBeLessThan(MAP_SPACING);
  });

  test("is deterministic and keeps regions apart on a big map", () => {
    const make = () => Array.from({ length: 96 }, (_, index) => ({ id: String(index), region: index % 4, x: 0, y: 0, placed: false }));
    const links: Array<[number, number]> = Array.from({ length: 92 }, (_, index) => [index, index + 4]);
    const one = make();
    const two = make();
    computeLayout("seed", one, links, 4);
    computeLayout("seed", two, links, 4);
    expect(one).toEqual(two);
    // Each region's skills sit closer to their own centre than to another region's.
    const centres = [0, 1, 2, 3].map((region) => {
      const nodes = one.filter((node) => node.region === region);
      return { x: nodes.reduce((sum, node) => sum + node.x, 0) / nodes.length, y: nodes.reduce((sum, node) => sum + node.y, 0) / nodes.length };
    });
    const home = one.filter((node) => {
      const distances = centres.map((centre) => Math.hypot(node.x - centre.x, node.y - centre.y));
      return distances.indexOf(Math.min(...distances)) === node.region;
    });
    expect(home.length / one.length).toBeGreaterThan(0.9);
  });
});

describe("unlock in order", () => {
  test("start skills are open, and finishing a skill opens its links", () => {
    const { user, subjectId, a, b, c, d } = chain();
    expect(skillsOf(user.id, subjectId).some((skill) => skill.locked)).toBe(false);
    updateSubject(user.id, subjectId, { unlockInOrder: true });
    const locked = () => skillsOf(user.id, subjectId).filter((skill) => skill.locked).map((skill) => skill.id).sort();
    // No start marked: the first skill is the start.
    expect(locked()).toEqual([b, c, d].sort());
    expect(() => getPracticeSession(user.id, c)).toThrow("locked");
    finish(user.id, a);
    expect(locked()).toEqual([c]);
    updateSkill(user.id, c, { start: true });
    expect(locked()).toEqual([]);
    expect(getPracticeSession(user.id, c).skillId).toBe(c);
  });
});

describe("agent", () => {
  test("putSkill start and linkTo, linkSkills, unlinkSkills and unlockInOrder match the web", () => {
    const user = makeUser();
    const subjectId = run(user.id, { op: "putSubject", subject: { name: "Maths", unlockInOrder: true } }).id as string;
    const unitId = run(user.id, { op: "putUnit", unit: { subjectId, title: "Basics" } }).id as string;
    const a = run(user.id, { op: "putSkill", skill: { unitId, title: "Counting", start: true } }).id as string;
    const b = run(user.id, { op: "putSkill", skill: { unitId, title: "Adding", linkTo: [a] } }).id as string;
    const c = run(user.id, { op: "putSkill", skill: { unitId, title: "Shapes" } }).id as string;
    run(user.id, { op: "linkSkills", a: c, b });
    let read = readSubject(user.id, subjectId);
    expect(read.subject.unlockInOrder).toBe(true);
    expect(read.links).toHaveLength(2);
    expect(read.units[0]!.skills.map((skill) => [skill.title, skill.start, skill.locked])).toEqual([["Counting", true, false], ["Adding", false, true], ["Shapes", false, true]]);
    run(user.id, { op: "unlinkSkills", a: b, b: c });
    read = readSubject(user.id, subjectId);
    expect(read.links).toEqual([[a, b].sort() as [string, string]]);
    expect(() => run(user.id, { op: "linkSkills", a, b: a })).toThrow(AgentError);
    expect(() => run(user.id, { op: "linkSkills", a, b: crypto.randomUUID() })).toThrow("Skill not found");
  });
});

describe("export and import", () => {
  test("links, start skills and unlockInOrder survive a .halolesson round trip and an update", () => {
    const { user, subjectId, a, b, c } = chain();
    updateSkill(user.id, a, { start: true });
    updateSubject(user.id, subjectId, { unlockInOrder: true });
    const file = buildExport(user.id, subjectId);
    const parsed = parseImport(readUpload(toHalolesson(file)));

    const friend = makeUser();
    const [copy] = importSubjects(friend.id, parsed.subjects).subjects;
    const imported = getSubject(friend.id, copy!.id);
    const titleOf = new Map(imported.units.flatMap((unit) => unit.skills).map((skill) => [skill.id, skill.title]));
    expect(imported.subject.unlockInOrder).toBe(true);
    expect(imported.links.map((link) => link.map((id) => titleOf.get(id)).sort().join("-")).sort()).toEqual(["Adding-Counting", "Adding-Multiplying", "Counting-Shapes"]);
    expect(imported.units[0]!.skills.find((skill) => skill.title === "Counting")!.start).toBe(true);

    // The author drops a link; the friend's update follows it.
    unlinkSkills(user.id, b, c);
    const newer = parseImport(readUpload(toHalolesson(buildExport(user.id, subjectId))));
    importSubjects(friend.id, newer.subjects, [], { choices: ["update"] });
    expect(getSubject(friend.id, copy!.id).links).toHaveLength(2);
  });
});
