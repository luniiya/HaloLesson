// The FSRS-6 memory model (Free Spaced Repetition Scheduler, Jarrett Ye et
// al.), ported from ts-fsrs (MIT, Open Spaced Repetition) with its default
// weights. Each exercise a learner has answered has a memory state:
// difficulty (1 to 10) and stability (days until the chance of recall falls
// to 90%). The state is never stored: it is replayed from the attempts, so
// imports and old answers always agree with it.

const W = [0.212, 1.2931, 2.3065, 8.2956, 6.4133, 0.8334, 3.0194, 0.001, 1.8722, 0.1666, 0.796, 1.4835, 0.0614, 0.2629, 1.6483, 0.6014, 1.8729, 0.5425, 0.0912, 0.0658, 0.1542] as const;
const DECAY = -W[20];
const FACTOR = Math.exp(Math.log(0.9) / DECAY) - 1;
const S_MIN = 0.001;
const S_MAX = 36500;
const DAY_MS = 86_400_000;

// FSRS ratings: 1 again (wrong), 2 hard, 3 good, 4 easy.
export type Grade = 1 | 2 | 3 | 4;

export interface MemoryState {
  difficulty: number;
  stability: number;
  // When it was last answered, in ms.
  at: number;
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

// The chance of recalling it now, 0 to 1.
export function recall(state: MemoryState, now: number): number {
  const days = Math.max(0, (now - state.at) / DAY_MS);
  return Math.pow(1 + (FACTOR * days) / state.stability, DECAY);
}

const initDifficulty = (grade: Grade) => W[4] - Math.exp((grade - 1) * W[5]) + 1;

function nextDifficulty(difficulty: number, grade: Grade): number {
  const delta = -W[6] * (grade - 3);
  const next = difficulty + (delta * (10 - difficulty)) / 9;
  return clamp(W[7] * initDifficulty(4) + (1 - W[7]) * next, 1, 10);
}

function recallStability(d: number, s: number, r: number, grade: Grade): number {
  const hard = grade === 2 ? W[15] : 1;
  const easy = grade === 4 ? W[16] : 1;
  return clamp(s * (1 + Math.exp(W[8]) * (11 - d) * Math.pow(s, -W[9]) * (Math.exp((1 - r) * W[10]) - 1) * hard * easy), S_MIN, S_MAX);
}

function forgetStability(d: number, s: number, r: number): number {
  return clamp(W[11] * Math.pow(d, -W[12]) * (Math.pow(s + 1, W[13]) - 1) * Math.exp((1 - r) * W[14]), S_MIN, S_MAX);
}

function shortTermStability(s: number, grade: Grade): number {
  const increase = Math.pow(s, -W[19]) * Math.exp(W[17] * (grade - 3 + W[18]));
  return clamp(s * (grade >= 2 ? Math.max(increase, 1) : increase), S_MIN, S_MAX);
}

// The state after answering at `at` (ms) with `grade`. Answers on the same
// day use FSRS's short-term formula.
export function review(state: MemoryState | null, at: number, grade: Grade): MemoryState {
  if (!state) return { difficulty: clamp(initDifficulty(grade), 1, 10), stability: clamp(W[grade - 1], S_MIN, S_MAX), at };
  const { difficulty: d, stability: s } = state;
  const days = Math.max(0, (at - state.at) / DAY_MS);
  const r = recall(state, at);
  let stability: number;
  if (days < 1) stability = shortTermStability(s, grade);
  else if (grade === 1) stability = clamp(s / Math.exp(W[17] * W[18]), S_MIN, forgetStability(d, s, r));
  else stability = recallStability(d, s, r, grade);
  return { difficulty: nextDifficulty(d, grade), stability, at };
}

// A wrong answer is "again". A right one is "hard" when it took more than
// twice the learner's usual time, "easy" under half of it, else "good".
export function gradeOf(correct: boolean, durationMs: number | null, typicalMs: number | null): Grade {
  if (!correct) return 1;
  if (durationMs === null || !typicalMs) return 3;
  if (durationMs > typicalMs * 2) return 2;
  if (durationMs < typicalMs / 2) return 4;
  return 3;
}
