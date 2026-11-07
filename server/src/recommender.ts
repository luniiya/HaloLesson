import { TIERS, medalFor, type ConceptStruggle, type SkillInsight } from "@halolesson/shared";
import { db } from "./db";
import { gradeOf, recall, review, type MemoryState } from "./memory";

// Picks the questions of a session. The learner wants the hardest material
// first, so each exercise of the tier's pool is scored by how likely it is
// to be failed right now and the highest scores win:
// - the FSRS memory state (memory.ts), replayed from every attempt, including
//   attempts from failed or abandoned sessions: low recall and high
//   difficulty push an exercise up;
// - a wrong last answer pushes it up a lot;
// - answers much slower than the learner's usual pace push it up a little;
// - unseen exercises sit in the middle so new material keeps coming in.

interface AttemptRow {
  exercise_id: string;
  is_correct: number;
  duration_ms: number | null;
  created_at: string;
}

export interface ExerciseHistory {
  state: MemoryState | null;
  answered: number;
  wrong: number;
  lastWrong: boolean;
  durations: number[];
}

const median = (values: number[]) => {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle]! : (sorted[middle - 1]! + sorted[middle]!) / 2;
};

// Replays the learner's attempts on a skill's exercises.
export function skillHistory(userId: string, skillId: string): { histories: Map<string, ExerciseHistory>; typicalMs: number | null } {
  const attempts = db.query<AttemptRow, [string, string]>(`
    SELECT attempts.exercise_id, attempts.is_correct, attempts.duration_ms, attempts.created_at FROM attempts
    JOIN exercises ON exercises.id = attempts.exercise_id
    WHERE attempts.user_id = ? AND exercises.skill_id = ? ORDER BY attempts.created_at
  `).all(userId, skillId);
  const typicalMs = median(attempts.flatMap((attempt) => (attempt.is_correct && attempt.duration_ms !== null ? [attempt.duration_ms] : [])));
  const histories = new Map<string, ExerciseHistory>();
  for (const attempt of attempts) {
    const history = histories.get(attempt.exercise_id) ?? { state: null, answered: 0, wrong: 0, lastWrong: false, durations: [] };
    const correct = attempt.is_correct === 1;
    history.state = review(history.state, Date.parse(attempt.created_at), gradeOf(correct, attempt.duration_ms, typicalMs));
    history.answered += 1;
    if (!correct) history.wrong += 1;
    history.lastWrong = !correct;
    if (attempt.duration_ms !== null) history.durations.push(attempt.duration_ms);
    histories.set(attempt.exercise_id, history);
  }
  return { histories, typicalMs };
}

const UNSEEN_SCORE = 0.45;

// How much the learner would struggle with an exercise now: higher is harder.
export function struggleScore(history: ExerciseHistory | undefined, typicalMs: number | null, now: number): number {
  if (!history?.state) return UNSEEN_SCORE;
  const failChance = 1 - recall(history.state, now);
  const hardness = (history.state.difficulty - 1) / 9;
  const pace = median(history.durations);
  const slow = pace && typicalMs ? Math.min(1, Math.max(0, pace / typicalMs - 1)) : 0;
  return 0.45 * failChance + 0.3 * hardness + 0.15 * slow + (history.lastWrong ? 0.5 : 0);
}

// The session's exercises: the hardest `size` of the tier's pool, in a
// shuffled order so the hardest don't all come first.
export function pickExercises(userId: string, skillId: string, tier: number, size: number, random = Math.random): string[] {
  const pool = db.query<{ id: string }, [string, number]>("SELECT id FROM exercises WHERE skill_id = ? AND tier = ? ORDER BY position, created_at").all(skillId, tier);
  const { histories, typicalMs } = skillHistory(userId, skillId);
  const now = Date.now();
  // A little noise so equal scores (like unseen exercises) rotate.
  const chosen = pool
    .map((exercise) => ({ id: exercise.id, score: struggleScore(histories.get(exercise.id), typicalMs, now) + random() * 0.08 }))
    .sort((a, b) => b.score - a.score)
    .slice(0, size)
    .map((exercise) => exercise.id);
  for (let index = chosen.length - 1; index > 0; index -= 1) {
    const other = Math.floor(random() * (index + 1));
    [chosen[index], chosen[other]] = [chosen[other]!, chosen[index]!];
  }
  return chosen;
}

const parseConcepts = (json: string): string[] => {
  const value: unknown = JSON.parse(json);
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
};

// What the learner struggles with on a skill: per concept tag, and the
// exercises they would most likely fail now. Shared by the web UI and agents.
export function skillInsight(userId: string, skillId: string): SkillInsight {
  const progress = db.query<{ tiers_cleared: number; expert_cleared_at: string | null }, [string, string]>(
    "SELECT tiers_cleared, expert_cleared_at FROM skill_progress WHERE user_id = ? AND skill_id = ?",
  ).get(userId, skillId);
  const exercises = db.query<{ id: string; prompt: string; tier: number; concepts_json: string }, [string]>(
    "SELECT id, prompt, tier, concepts_json FROM exercises WHERE skill_id = ? ORDER BY tier, position",
  ).all(skillId);
  const { histories, typicalMs } = skillHistory(userId, skillId);
  const now = Date.now();

  const concepts = new Map<string, { answered: number; wrong: number; durations: number[] }>();
  for (const exercise of exercises) {
    const history = histories.get(exercise.id);
    if (!history) continue;
    for (const concept of parseConcepts(exercise.concepts_json)) {
      const entry = concepts.get(concept) ?? { answered: 0, wrong: 0, durations: [] };
      entry.answered += history.answered;
      entry.wrong += history.wrong;
      entry.durations.push(...history.durations);
      concepts.set(concept, entry);
    }
  }
  const struggles: ConceptStruggle[] = [...concepts].map(([concept, entry]) => ({
    concept,
    answered: entry.answered,
    wrong: entry.wrong,
    failRate: Math.round((entry.wrong / entry.answered) * 100) / 100,
    medianMs: median(entry.durations),
  })).sort((a, b) => b.failRate - a.failRate || b.wrong - a.wrong);

  const hardest = exercises
    .flatMap((exercise) => {
      const history = histories.get(exercise.id);
      if (!history?.state) return [];
      return [{
        exerciseId: exercise.id,
        prompt: exercise.prompt,
        tier: TIERS[exercise.tier] ?? "easy",
        concepts: parseConcepts(exercise.concepts_json),
        answered: history.answered,
        wrong: history.wrong,
        recall: Math.round(recall(history.state, now) * 100) / 100,
        lastWrong: history.lastWrong,
        score: struggleScore(history, typicalMs, now),
      }];
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 10)
    .map(({ score: _score, ...rest }) => rest);

  return {
    skillId,
    tiersCleared: progress?.tiers_cleared ?? 0,
    medal: medalFor(progress?.expert_cleared_at ?? null),
    expertClearedAt: progress?.expert_cleared_at ?? null,
    concepts: struggles,
    hardest,
  };
}
