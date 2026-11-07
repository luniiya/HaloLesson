import { libraryStates, medalFor, STATS_RANGES, TIERS, type Stats, type StatsDay, type StatsItem, type StatsSkill, type Subject } from "@halolesson/shared";
import { db } from "./db";
import { getLibrary } from "./library";
import { getSubject } from "./subjects";

const DAY_MS = 24 * 60 * 60 * 1000;

export interface StatsOptions {
  subjectId?: string | null;
  // One of STATS_RANGES, or null for all time.
  days?: number | null;
  // Minutes to add to local time to get UTC, as Date#getTimezoneOffset returns.
  tzOffset?: number;
}

interface AttemptRow {
  created_at: string;
  is_correct: number;
  duration_ms: number | null;
  mastery_after: number | null;
  skill_id: string;
  subject_id: string;
}

interface SkillRow {
  id: string;
  title: string;
  unit_title: string;
  subject_id: string;
  tiers_cleared: number | null;
  expert_cleared_at: string | null;
  mastery: number | null;
  total_attempts: number | null;
  last_practiced_at: string | null;
}

interface LevelRow {
  subject_id: string;
  level: number | null;
  created_at: string;
}

export function checkStatsOptions(input: { subjectId?: unknown; days?: unknown; tzOffset?: unknown }): StatsOptions {
  const days = input.days === undefined || input.days === null || input.days === "all" ? null : Number(input.days);
  if (days !== null && !(STATS_RANGES as readonly number[]).includes(days)) throw new Error(`Days must be one of ${STATS_RANGES.join(", ")} or all`);
  const tzOffset = input.tzOffset === undefined || input.tzOffset === null || input.tzOffset === "" ? 0 : Number(input.tzOffset);
  if (!Number.isInteger(tzOffset) || Math.abs(tzOffset) > 14 * 60) throw new Error("tzOffset must be whole minutes between -840 and 840");
  const subjectId = typeof input.subjectId === "string" && input.subjectId ? input.subjectId : null;
  return { subjectId, days, tzOffset };
}

const placeholders = (count: number) => Array.from({ length: count }, () => "?").join(", ");

// Practice and rating statistics for one subject or tracker, or for everything
// not in the trash. Shared by the web page and the agent API.
export function getStats(userId: string, options: StatsOptions = {}): Stats {
  const { subjectId = null, days = null, tzOffset = 0 } = options;
  const offsetMs = tzOffset * 60 * 1000;
  const dayOf = (iso: string) => new Date(Date.parse(iso) - offsetMs).toISOString().slice(0, 10);
  const startOfDay = (day: string) => Date.parse(`${day}T00:00:00.000Z`) + offsetMs;
  const addDays = (day: string, count: number) => new Date(Date.parse(`${day}T00:00:00.000Z`) + count * DAY_MS).toISOString().slice(0, 10);

  let subjects: Subject[];
  if (subjectId) {
    subjects = [getSubject(userId, subjectId).subject];
  } else {
    const library = getLibrary(userId);
    const states = libraryStates(library);
    subjects = library.subjects.filter((subject) => states.get(subject.id) !== "trashed");
  }
  const ids = subjects.map((subject) => subject.id);
  const inScope = placeholders(ids.length);

  const attempts = ids.length ? db.query<AttemptRow, string[]>(`
    SELECT attempts.created_at, attempts.is_correct, attempts.duration_ms, attempts.mastery_after, skills.id AS skill_id, units.subject_id
    FROM attempts JOIN exercises ON exercises.id = attempts.exercise_id JOIN skills ON skills.id = exercises.skill_id
    JOIN units ON units.id = skills.unit_id
    WHERE attempts.user_id = ? AND units.subject_id IN (${inScope}) ORDER BY attempts.created_at
  `).all(userId, ...ids) : [];
  const skills = ids.length ? db.query<SkillRow, string[]>(`
    SELECT skills.id, skills.title, units.title AS unit_title, units.subject_id, skill_progress.tiers_cleared, skill_progress.expert_cleared_at, skill_progress.mastery,
      skill_progress.total_attempts, skill_progress.last_practiced_at
    FROM skills JOIN units ON units.id = skills.unit_id
    LEFT JOIN skill_progress ON skill_progress.skill_id = skills.id AND skill_progress.user_id = ?
    WHERE units.subject_id IN (${inScope}) ORDER BY units.subject_id, units.position, skills.position
  `).all(userId, ...ids) : [];
  const ratings = ids.length ? db.query<LevelRow, string[]>(`
    SELECT subject_id, level, created_at FROM level_history WHERE user_id = ? AND subject_id IN (${inScope}) ORDER BY created_at
  `).all(userId, ...ids) : [];

  const activity = [...attempts.map((row) => row.created_at), ...ratings.map((row) => row.created_at)].sort();
  const firstActivityAt = activity[0] ?? null;
  const lastActivityAt = activity.at(-1) ?? null;
  const to = dayOf(new Date().toISOString());
  const from = days ? addDays(to, -(days - 1)) : firstActivityAt && dayOf(firstActivityAt) < to ? dayOf(firstActivityAt) : to;
  const fromMs = startOfDay(from);
  const inRange = (iso: string) => Date.parse(iso) >= fromMs;

  // Daily buckets, replaying mastery so each day ends with every skill's level then.
  const scopeSkills = new Set(skills.map((skill) => skill.id));
  const mastery = new Map<string, number>();
  let masterySum = 0;
  let next = 0;
  const daily: StatsDay[] = [];
  const weekdays = Array.from({ length: 7 }, () => 0);
  const hours = Array.from({ length: 24 }, () => 0);
  for (let day = from; day <= to; day = addDays(day, 1)) {
    const end = startOfDay(addDays(day, 1));
    const bucket: StatsDay = { date: day, answered: 0, correct: 0, timeMs: 0, mastery: 0 };
    while (next < attempts.length && Date.parse(attempts[next]!.created_at) < end) {
      const attempt = attempts[next++]!;
      const before = mastery.get(attempt.skill_id) ?? 0;
      // Answers from before mastery was stored: the same rule practice.ts applies.
      const after = attempt.mastery_after ?? (attempt.is_correct ? before + (1 - before) * 0.22 : before * 0.75);
      if (scopeSkills.has(attempt.skill_id)) masterySum += after - before;
      mastery.set(attempt.skill_id, after);
      if (!inRange(attempt.created_at)) continue;
      bucket.answered += 1;
      bucket.correct += attempt.is_correct;
      bucket.timeMs += attempt.duration_ms ?? 0;
      const local = new Date(Date.parse(attempt.created_at) - offsetMs);
      weekdays[(local.getUTCDay() + 6) % 7]! += 1;
      hours[local.getUTCHours()]! += 1;
    }
    bucket.mastery = skills.length ? round(masterySum / skills.length) : 0;
    daily.push(bucket);
  }

  // Streaks count every answer ever made, whatever the range.
  const activeDays = new Set(attempts.map((attempt) => dayOf(attempt.created_at)));
  let currentStreak = 0;
  for (let day = activeDays.has(to) ? to : addDays(to, -1); activeDays.has(day); day = addDays(day, -1)) currentStreak += 1;
  let longestStreak = 0;
  let run = 0;
  let previous = "";
  for (const day of [...activeDays].sort()) {
    run = previous && addDays(previous, 1) === day ? run + 1 : 1;
    longestStreak = Math.max(longestStreak, run);
    previous = day;
  }

  const ranged = attempts.filter((attempt) => inRange(attempt.created_at));
  const tally = (rows: AttemptRow[]) => ({
    answered: rows.length,
    correct: rows.reduce((sum, row) => sum + row.is_correct, 0),
    timeMs: rows.reduce((sum, row) => sum + (row.duration_ms ?? 0), 0),
  });

  const levelAtStart = new Map<string, number | null>();
  for (const rating of ratings) if (!inRange(rating.created_at)) levelAtStart.set(rating.subject_id, rating.level);
  const levels = [
    ...[...levelAtStart].map(([id, level]) => ({ subjectId: id, level, at: new Date(fromMs).toISOString() })),
    ...ratings.filter((rating) => inRange(rating.created_at)).map((rating) => ({ subjectId: rating.subject_id, level: rating.level, at: rating.created_at })),
  ];

  const items: StatsItem[] = subjects.map((subject) => {
    const own = skills.filter((skill) => skill.subject_id === subject.id);
    const latest = [...attempts.filter((row) => row.subject_id === subject.id).map((row) => row.created_at), ...ratings.filter((row) => row.subject_id === subject.id).map((row) => row.created_at)].sort().at(-1) ?? null;
    return {
      id: subject.id,
      type: subject.type,
      name: subject.name,
      color: subject.color,
      icon: subject.icon,
      level: subject.level,
      levelAtStart: levelAtStart.get(subject.id) ?? null,
      ...tally(ranged.filter((row) => row.subject_id === subject.id)),
      skillCount: subject.skillCount,
      completedCount: subject.completedCount,
      mastery: own.length ? round(own.reduce((sum, skill) => sum + (skill.mastery ?? 0), 0) / own.length) : 0,
      lastActivityAt: latest,
    };
  });

  const skillStats: StatsSkill[] = subjectId ? skills.map((skill) => ({
    id: skill.id,
    title: skill.title,
    unitTitle: skill.unit_title,
    tiersCleared: skill.tiers_cleared ?? 0,
    medal: medalFor(skill.expert_cleared_at),
    mastery: round(skill.mastery ?? 0),
    ...tally(ranged.filter((row) => row.skill_id === skill.id)),
    lastPracticedAt: skill.last_practiced_at,
  })) : [];

  return {
    subjectId,
    days,
    from,
    to,
    totals: {
      ...tally(ranged),
      practiceDays: daily.filter((day) => day.answered > 0).length,
      currentStreak,
      longestStreak,
      skillCount: skills.length,
      skillsStarted: skills.filter((skill) => (skill.total_attempts ?? 0) > 0).length,
      skillsMastered: skills.filter((skill) => skill.tiers_cleared === TIERS.length).length,
      ratings: ratings.filter((rating) => inRange(rating.created_at)).length,
      firstActivityAt,
      lastActivityAt,
    },
    daily,
    weekdays,
    hours,
    levels,
    items,
    skills: skillStats,
  };
}

const round = (value: number) => Math.round(value * 1000) / 1000;
