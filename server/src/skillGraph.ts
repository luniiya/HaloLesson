import { MAP_SPACING, MAP_Y_SCALE, MAX_LINKS_PER_SKILL, skillLocks } from "@halolesson/shared";
import { db } from "./db";

// The skill map of a subject: regions (stored as units), skills and the links
// between them. The web UI and the agent ops both call these, so the rules
// stay the same everywhere. Errors are plain Errors with user-readable
// messages; "... not found" messages become 404s.

export const MAX_REGIONS_PER_SUBJECT = 100;
export const MAX_SKILLS_PER_REGION = 100;
// The region a skill lands in when the subject has none yet.
export const DEFAULT_REGION_TITLE = "Basics";

function text(value: unknown, label: string, max: number, required = false): string {
  if (value !== undefined && value !== null && typeof value !== "string") throw new Error(`${label} must be text`);
  const trimmed = (value ?? "").trim();
  if (required && !trimmed) throw new Error(`${label} is required`);
  if (trimmed.length > max) throw new Error(`${label} must be ${max} characters or fewer`);
  return trimmed;
}

const count = (sql: string, ...params: string[]) => db.query<{ count: number }, string[]>(sql).get(...params)!.count;

// A subject the user owns that can hold skills (not a tracker, not in the trash).
export function graphSubject(userId: string, subjectId: string): void {
  const row = db.query<{ type: string; deleted_at: string | null }, [string, string]>("SELECT type, deleted_at FROM subjects WHERE id = ? AND user_id = ?").get(subjectId, userId);
  if (!row || row.deleted_at) throw new Error("Subject not found");
  if (row.type === "tracker") throw new Error("A tracker has no skills; only subjects have a skill map");
}

function ownedRegion(userId: string, unitId: string): { subjectId: string } {
  const row = db.query<{ subject_id: string }, [string, string]>(
    "SELECT units.subject_id FROM units JOIN subjects ON subjects.id = units.subject_id WHERE units.id = ? AND subjects.user_id = ?",
  ).get(unitId, userId);
  if (!row) throw new Error("Region not found");
  return { subjectId: row.subject_id };
}

export function ownedGraphSkill(userId: string, skillId: string): { subjectId: string; unitId: string } {
  const row = db.query<{ subject_id: string; unit_id: string }, [string, string]>(
    `SELECT units.subject_id, skills.unit_id FROM skills JOIN units ON units.id = skills.unit_id
     JOIN subjects ON subjects.id = units.subject_id WHERE skills.id = ? AND subjects.user_id = ?`,
  ).get(skillId, userId);
  if (!row) throw new Error("Skill not found");
  return { subjectId: row.subject_id, unitId: row.unit_id };
}

const nextPosition = (table: "units" | "skills", column: "subject_id" | "unit_id", parentId: string) =>
  db.query<{ next: number }, [string]>(`SELECT COALESCE(MAX(position) + 1, 0) AS next FROM ${table} WHERE ${column} = ?`).get(parentId)!.next;

// ---- Regions ----

export interface RegionFields {
  title?: unknown;
  description?: unknown;
}

export function createRegion(userId: string, subjectId: string, fields: RegionFields): { id: string } {
  graphSubject(userId, subjectId);
  if (count("SELECT COUNT(*) AS count FROM units WHERE subject_id = ?", subjectId) >= MAX_REGIONS_PER_SUBJECT) throw new Error(`At most ${MAX_REGIONS_PER_SUBJECT} regions per subject`);
  const id = crypto.randomUUID();
  db.run("INSERT INTO units (id, subject_id, title, description, position, created_at) VALUES (?, ?, ?, ?, ?, ?)", [
    id, subjectId, text(fields.title, "Region name", 120, true), text(fields.description, "Region description", 500), nextPosition("units", "subject_id", subjectId), new Date().toISOString(),
  ]);
  return { id };
}

export function updateRegion(userId: string, unitId: string, fields: RegionFields): { subjectId: string } {
  const { subjectId } = ownedRegion(userId, unitId);
  const current = db.query<{ title: string; description: string }, [string]>("SELECT title, description FROM units WHERE id = ?").get(unitId)!;
  db.run("UPDATE units SET title = ?, description = ? WHERE id = ?", [
    fields.title === undefined ? current.title : text(fields.title, "Region name", 120, true),
    fields.description === undefined ? current.description : text(fields.description, "Region description", 500),
    unitId,
  ]);
  return { subjectId };
}

// Deleting a region deletes its skills (and their progress) too.
export function deleteRegion(userId: string, unitId: string): { subjectId: string } {
  const { subjectId } = ownedRegion(userId, unitId);
  db.run("DELETE FROM units WHERE id = ?", [unitId]);
  return { subjectId };
}

// ---- Skills ----

export interface SkillFields {
  title?: unknown;
  description?: unknown;
  // The region; for a new skill it defaults to the region of the first linked
  // skill, then the subject's first region (made on the spot if there is none).
  unitId?: unknown;
  start?: unknown;
}

function regionFor(userId: string, subjectId: string, unitId: unknown, near: string[]): string {
  if (unitId !== undefined && unitId !== null) {
    if (typeof unitId !== "string" || ownedRegion(userId, unitId).subjectId !== subjectId) throw new Error("Region not found");
    return unitId;
  }
  for (const skillId of near) {
    const skill = ownedGraphSkill(userId, skillId);
    if (skill.subjectId === subjectId) return skill.unitId;
  }
  const first = db.query<{ id: string }, [string]>("SELECT id FROM units WHERE subject_id = ? ORDER BY position, created_at LIMIT 1").get(subjectId);
  return first?.id ?? createRegion(userId, subjectId, { title: DEFAULT_REGION_TITLE }).id;
}

function checkRegionRoom(unitId: string) {
  if (count("SELECT COUNT(*) AS count FROM skills WHERE unit_id = ?", unitId) >= MAX_SKILLS_PER_REGION) throw new Error(`At most ${MAX_SKILLS_PER_REGION} skills per region`);
}

function checkStart(value: unknown): boolean | undefined {
  if (value !== undefined && typeof value !== "boolean") throw new Error("start must be true or false");
  return value;
}

// `linkTo` links the new skill to these skills of the same subject.
export function createSkill(userId: string, subjectId: string, fields: SkillFields & { linkTo?: unknown }): { id: string } {
  graphSubject(userId, subjectId);
  const title = text(fields.title, "Skill name", 120, true);
  const description = text(fields.description, "Skill description", 500);
  const start = checkStart(fields.start) ?? false;
  if (fields.linkTo !== undefined && (!Array.isArray(fields.linkTo) || fields.linkTo.some((id) => typeof id !== "string"))) throw new Error("linkTo must be a list of skill ids");
  const linkTo = (fields.linkTo ?? []) as string[];
  const unitId = regionFor(userId, subjectId, fields.unitId, linkTo);
  checkRegionRoom(unitId);
  const id = crypto.randomUUID();
  db.run("INSERT INTO skills (id, unit_id, title, description, position, is_start, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)", [
    id, unitId, title, description, nextPosition("skills", "unit_id", unitId), start ? 1 : 0, new Date().toISOString(),
  ]);
  for (const other of linkTo) linkSkills(userId, id, other);
  return { id };
}

export function updateSkill(userId: string, skillId: string, fields: SkillFields): { subjectId: string } {
  const { subjectId, unitId: currentUnit } = ownedGraphSkill(userId, skillId);
  const current = db.query<{ title: string; description: string }, [string]>("SELECT title, description FROM skills WHERE id = ?").get(skillId)!;
  const title = fields.title === undefined ? current.title : text(fields.title, "Skill name", 120, true);
  const description = fields.description === undefined ? current.description : text(fields.description, "Skill description", 500);
  const unitId = fields.unitId === undefined ? currentUnit : regionFor(userId, subjectId, fields.unitId, []);
  if (unitId !== currentUnit) checkRegionRoom(unitId);
  db.run("UPDATE skills SET title = ?, description = ?, unit_id = ? WHERE id = ?", [title, description, unitId, skillId]);
  if (unitId !== currentUnit) db.run("UPDATE skills SET position = ? WHERE id = ?", [nextPosition("skills", "unit_id", unitId), skillId]);
  const start = checkStart(fields.start);
  if (start !== undefined) db.run("UPDATE skills SET is_start = ? WHERE id = ?", [start ? 1 : 0, skillId]);
  return { subjectId };
}

export function deleteSkill(userId: string, skillId: string): { subjectId: string } {
  const { subjectId } = ownedGraphSkill(userId, skillId);
  db.run("DELETE FROM skills WHERE id = ?", [skillId]);
  return { subjectId };
}

// ---- Links ----

const pair = (a: string, b: string): [string, string] => (a < b ? [a, b] : [b, a]);
const linkCount = (skillId: string) => count("SELECT COUNT(*) AS count FROM skill_links WHERE a = ? OR b = ?", skillId, skillId);

export function linkSkills(userId: string, first: string, second: string): { subjectId: string } {
  if (first === second) throw new Error("A skill can't link to itself");
  const one = ownedGraphSkill(userId, first);
  const two = ownedGraphSkill(userId, second);
  if (one.subjectId !== two.subjectId) throw new Error("Only skills of the same subject can be linked");
  const [a, b] = pair(first, second);
  if (db.query("SELECT 1 FROM skill_links WHERE a = ? AND b = ?").get(a, b)) return { subjectId: one.subjectId };
  if (linkCount(first) >= MAX_LINKS_PER_SKILL || linkCount(second) >= MAX_LINKS_PER_SKILL) throw new Error(`A skill can have at most ${MAX_LINKS_PER_SKILL} links`);
  db.run("INSERT INTO skill_links (subject_id, a, b, created_at) VALUES (?, ?, ?, ?)", [one.subjectId, a, b, new Date().toISOString()]);
  return { subjectId: one.subjectId };
}

export function unlinkSkills(userId: string, first: string, second: string): { subjectId: string } {
  const { subjectId } = ownedGraphSkill(userId, first);
  ownedGraphSkill(userId, second);
  const [a, b] = pair(first, second);
  db.run("DELETE FROM skill_links WHERE a = ? AND b = ?", [a, b]);
  return { subjectId };
}

// ---- Locks ----

// Whether practice is closed for this skill (only when the subject unlocks in order).
export function isSkillLocked(userId: string, skillId: string): boolean {
  const { subjectId } = ownedGraphSkill(userId, skillId);
  if (!db.query("SELECT 1 FROM subjects WHERE id = ? AND unlock_in_order = 1").get(subjectId)) return false;
  const skills = db.query<{ id: string; stars: number; is_start: number }, [string, string]>(
    `SELECT skills.id, COALESCE(skill_progress.stars, 0) AS stars, skills.is_start FROM skills
     JOIN units ON units.id = skills.unit_id
     LEFT JOIN skill_progress ON skill_progress.skill_id = skills.id AND skill_progress.user_id = ?
     WHERE units.subject_id = ? ORDER BY units.position, units.created_at, skills.position, skills.created_at`,
  ).all(userId, subjectId);
  const links = db.query<{ a: string; b: string }, [string]>("SELECT a, b FROM skill_links WHERE subject_id = ?").all(subjectId);
  return skillLocks(skills.map((skill) => ({ id: skill.id, stars: skill.stars, start: skill.is_start === 1 })), links.map((link) => [link.a, link.b])).has(skillId);
}

// ---- Layout ----
//
// A force layout run on the server: linked skills pull together like springs,
// every skill pushes its neighbours away, and each region pulls its skills
// toward its own centre so regions read as areas of the map. The result is
// stored on the skills; the browser only draws it. It is deterministic (seeded
// by the subject id) and starts from the stored positions, so adding a skill
// nudges the map instead of reshuffling it.
//
// It reruns lazily: getSubject calls ensureLayout, which compares a hash of
// the map's structure with the one stored at the last layout.

// Bump to relayout every subject after changing the algorithm.
const LAYOUT_VERSION = 4;

interface LayoutNode {
  id: string;
  region: number;
  x: number;
  y: number;
  placed: boolean;
}

function random(seed: string) {
  let state = Number(BigInt.asUintN(32, BigInt(Bun.hash(seed))));
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function computeLayout(seed: string, nodes: LayoutNode[], links: Array<[number, number]>, regionCount: number): void {
  const n = nodes.length;
  if (n === 0) return;
  const k = MAP_SPACING;
  const rand = random(seed);
  const neighbours = nodes.map(() => [] as number[]);
  for (const [a, b] of links) {
    neighbours[a]!.push(b);
    neighbours[b]!.push(a);
  }

  // Place new skills: next to their placed neighbours, else around their
  // region's placed skills, else on a ring of region centres.
  const fresh = nodes.every((node) => !node.placed);
  const ring = Math.sqrt(n) * k * 0.6;
  const regionHome = Array.from({ length: regionCount }, (_, region) => {
    const angle = (region / Math.max(regionCount, 1)) * Math.PI * 2 - Math.PI / 2;
    return regionCount === 1 ? { x: 0, y: 0 } : { x: Math.cos(angle) * ring, y: Math.sin(angle) * ring };
  });
  for (let pass = 0; pass < 2; pass += 1) {
    for (const node of nodes) {
      if (node.placed) continue;
      const near = neighbours[nodes.indexOf(node)]!.map((index) => nodes[index]!).filter((other) => other.placed);
      const sameRegion = nodes.filter((other) => other.placed && other.region === node.region);
      const anchor = near.length ? near : pass === 1 ? sameRegion : [];
      if (!anchor.length && pass === 0) continue;
      const centre = anchor.length
        ? { x: anchor.reduce((sum, other) => sum + other.x, 0) / anchor.length, y: anchor.reduce((sum, other) => sum + other.y, 0) / anchor.length }
        : regionHome[node.region] ?? { x: 0, y: 0 };
      const angle = rand() * Math.PI * 2;
      node.x = centre.x + Math.cos(angle) * k * (0.5 + rand() * 0.5);
      node.y = centre.y + Math.sin(angle) * k * (0.5 + rand() * 0.5);
      node.placed = true;
    }
  }

  // Repulsion only reaches this far, using a grid of buckets so big maps stay fast.
  const reach = k * 2.5;
  const cell = (gx: number, gy: number) => gx * 65536 + gy;
  const iterations = fresh ? 320 : 120;
  let heat = fresh ? k : k * 0.35;
  const cool = heat / iterations;
  const dx = new Float64Array(n);
  const dy = new Float64Array(n);
  for (let step = 0; step < iterations; step += 1) {
    dx.fill(0);
    dy.fill(0);
    const grid = new Map<number, number[]>();
    nodes.forEach((node, index) => {
      const key = cell(Math.floor(node.x / reach), Math.floor(node.y / reach));
      const bucket = grid.get(key);
      if (bucket) bucket.push(index);
      else grid.set(key, [index]);
    });
    for (let i = 0; i < n; i += 1) {
      const node = nodes[i]!;
      const cx = Math.floor(node.x / reach);
      const cy = Math.floor(node.y / reach);
      for (let gx = cx - 1; gx <= cx + 1; gx += 1) {
        for (let gy = cy - 1; gy <= cy + 1; gy += 1) {
          for (const j of grid.get(cell(gx, gy)) ?? []) {
            if (j <= i) continue;
            const other = nodes[j]!;
            let ox = node.x - other.x;
            let oy = node.y - other.y;
            let distance = Math.hypot(ox, oy);
            if (distance < 1) {
              ox = rand() - 0.5;
              oy = rand() - 0.5;
              distance = 1;
            }
            if (distance > reach) continue;
            // Skills of different regions push harder, so regions stay apart.
            const force = ((k * k) / distance) * (node.region === other.region ? 1 : 2.4);
            dx[i] += (ox / distance) * force;
            dy[i] += (oy / distance) * force;
            dx[j] -= (ox / distance) * force;
            dy[j] -= (oy / distance) * force;
          }
        }
      }
    }
    for (const [a, b] of links) {
      const one = nodes[a]!;
      const two = nodes[b]!;
      const ox = one.x - two.x;
      const oy = one.y - two.y;
      const distance = Math.max(Math.hypot(ox, oy), 1);
      // Links across regions pull gently, so they don't drag regions into each other.
      const force = ((distance * distance) / k) * (one.region === two.region ? 1 : 0.15);
      dx[a] -= (ox / distance) * force;
      dy[a] -= (oy / distance) * force;
      dx[b] += (ox / distance) * force;
      dy[b] += (oy / distance) * force;
    }
    // Each region pulls its skills toward its centre; a faint pull to the
    // middle keeps unlinked islands from drifting off.
    const sums = Array.from({ length: regionCount }, () => ({ x: 0, y: 0, count: 0 }));
    for (const node of nodes) {
      const sum = sums[node.region]!;
      sum.x += node.x;
      sum.y += node.y;
      sum.count += 1;
    }
    nodes.forEach((node, index) => {
      const sum = sums[node.region]!;
      dx[index] += (sum.x / sum.count - node.x) * 0.9 - node.x * 0.04;
      dy[index] += (sum.y / sum.count - node.y) * 0.9 - node.y * 0.04;
    });
    nodes.forEach((node, index) => {
      const length = Math.hypot(dx[index]!, dy[index]!);
      if (length === 0) return;
      const move = Math.min(length, heat);
      node.x += (dx[index]! / length) * move;
      node.y += (dy[index]! / length) * move;
    });
    heat = Math.max(heat - cool, k * 0.01);
  }

  // No two skills closer than this as drawn (y squashed by MAP_Y_SCALE), so
  // nodes and their titles never overlap.
  const gap = k * 0.95;
  for (let pass = 0; pass < 30; pass += 1) {
    let moved = false;
    for (let i = 0; i < n; i += 1) {
      for (let j = i + 1; j < n; j += 1) {
        const one = nodes[i]!;
        const two = nodes[j]!;
        const ox = two.x - one.x;
        const oy = (two.y - one.y) * MAP_Y_SCALE;
        const distance = Math.hypot(ox, oy);
        if (distance >= gap) continue;
        const push = (gap - distance) / 2 + 0.5;
        const ux = distance < 0.01 ? 1 : ox / distance;
        const uy = (distance < 0.01 ? 0 : oy / distance) / MAP_Y_SCALE;
        one.x -= ux * push;
        one.y -= uy * push;
        two.x += ux * push;
        two.y += uy * push;
        moved = true;
      }
    }
    if (!moved) break;
  }

  // Centre the map on 0,0 and round.
  const minX = Math.min(...nodes.map((node) => node.x));
  const maxX = Math.max(...nodes.map((node) => node.x));
  const minY = Math.min(...nodes.map((node) => node.y));
  const maxY = Math.max(...nodes.map((node) => node.y));
  for (const node of nodes) {
    node.x = Math.round(node.x - (minX + maxX) / 2);
    node.y = Math.round(node.y - (minY + maxY) / 2);
  }
}

export function ensureLayout(subjectId: string): void {
  const skills = db.query<{ id: string; unit_id: string; x: number | null; y: number | null }, [string]>(
    `SELECT skills.id, skills.unit_id, skills.x, skills.y FROM skills JOIN units ON units.id = skills.unit_id
     WHERE units.subject_id = ? ORDER BY units.position, units.created_at, skills.position, skills.created_at`,
  ).all(subjectId);
  const links = db.query<{ a: string; b: string }, [string]>("SELECT a, b FROM skill_links WHERE subject_id = ? ORDER BY a, b").all(subjectId);
  const shape = `${LAYOUT_VERSION}|${skills.map((skill) => `${skill.id}:${skill.unit_id}`).join(",")}|${links.map((link) => `${link.a}-${link.b}`).join(",")}`;
  const hash = Bun.hash(shape).toString(36);
  const stored = db.query<{ layout_hash: string | null }, [string]>("SELECT layout_hash FROM subjects WHERE id = ?").get(subjectId);
  if (!stored || stored.layout_hash === hash) return;

  const regions = [...new Set(skills.map((skill) => skill.unit_id))];
  const index = new Map(skills.map((skill, at) => [skill.id, at]));
  const nodes: LayoutNode[] = skills.map((skill) => ({
    id: skill.id,
    region: regions.indexOf(skill.unit_id),
    x: skill.x ?? 0,
    y: skill.y ?? 0,
    placed: skill.x !== null && skill.y !== null,
  }));
  computeLayout(subjectId, nodes, links.map((link) => [index.get(link.a)!, index.get(link.b)!]), regions.length);
  db.transaction(() => {
    for (const node of nodes) db.run("UPDATE skills SET x = ?, y = ? WHERE id = ?", [node.x, node.y, node.id]);
    db.run("UPDATE subjects SET layout_hash = ? WHERE id = ?", [hash, subjectId]);
  })();
}
