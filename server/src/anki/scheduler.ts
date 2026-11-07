// Port of Anki's v3 answer logic (rslib/src/scheduler/states + answering,
// Anki 26.09) and FSRS-6 (fsrs-rs 6.6). Given a card and its deck options it
// computes the four next states exactly as Anki does, except that the random
// fuzz factor comes from our own seeded generator: Anki's own generator
// (ChaCha) isn't ported, but every fuzzed value it can produce lies in the
// same bounds, so the outcome is one Anki itself could have picked.

export interface DeckOptions {
  learnSteps: number[]; // minutes
  relearnSteps: number[];
  graduatingIntervalGood: number;
  graduatingIntervalEasy: number;
  initialEase: number;
  easyMultiplier: number;
  hardMultiplier: number;
  lapseMultiplier: number;
  intervalMultiplier: number;
  maximumReviewInterval: number;
  minimumLapseInterval: number;
  leechThreshold: number;
  leechSuspend: boolean;
  capAnswerTimeSecs: number;
  newPerDay: number;
  reviewsPerDay: number;
  buryNew: boolean;
  buryReviews: boolean;
  buryInterdayLearning: boolean;
  fsrsParams: number[]; // raw, as stored (may be empty)
  desiredRetention: number;
}

export interface Timing {
  now: number; // unix seconds
  daysElapsed: number;
  nextDayAt: number; // unix seconds
}

export interface Memory {
  stability: number;
  difficulty: number;
}

export interface LearnState {
  kind: "learn";
  remainingSteps: number;
  scheduledSecs: number;
  memory: Memory | null;
}
export interface ReviewState {
  kind: "review";
  scheduledDays: number;
  elapsedDays: number;
  easeFactor: number;
  lapses: number;
  leeched: boolean;
  memory: Memory | null;
}
export interface RelearnState {
  kind: "relearn";
  learning: LearnState;
  review: ReviewState;
}
export interface NewState {
  kind: "new";
  position: number;
}
export type CardState = NewState | LearnState | ReviewState | RelearnState;

export interface NextStates {
  again: CardState;
  hard: CardState;
  good: CardState;
  easy: CardState;
}

// Card row as stored in the cards table.
export interface CardRow {
  id: number;
  nid: number;
  did: number;
  ord: number;
  mod: number;
  usn: number;
  type: number;
  queue: number;
  due: number;
  ivl: number;
  factor: number;
  reps: number;
  lapses: number;
  left: number;
  odue: number;
  odid: number;
  flags: number;
  data: string;
}

export interface RevlogRow {
  id: number;
  cid: number;
  usn: number;
  ease: number;
  ivl: number;
  lastIvl: number;
  factor: number;
  time: number;
  type: number;
}

const DAY = 86_400;
const INITIAL_EASE = 2.5;
const MINIMUM_EASE = 1.3;

// ---------- small numeric helpers matching Rust's casts ----------

const f32 = Math.fround;
// Rust `as u32` from float: truncates, saturates at 0.
const u32 = (value: number) => (Number.isNaN(value) ? 0 : Math.max(0, Math.min(4294967295, Math.trunc(value))));
// Rust f32::round rounds half away from zero.
const round = (value: number) => (value < 0 ? -Math.round(-value) : Math.round(value));
const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

// ---------- learning steps (states/steps.rs) ----------

class Steps {
  constructor(readonly steps: number[]) {}
  private toSecs(minutes: number) {
    return u32(f32(minutes * 60));
  }
  private index(remaining: number) {
    const total = this.steps.length;
    return Math.min(Math.max(total - (remaining % 1000), 0), Math.max(total - 1, 0));
  }
  private at(index: number): number | null {
    const step = this.steps[index];
    return step === undefined ? null : this.toSecs(step);
  }
  againDelay() {
    return this.at(0);
  }
  hardDelay(remaining: number): number | null {
    const index = this.index(remaining);
    const current = this.at(index) ?? (this.steps.length ? this.toSecs(this.steps[0]!) : null);
    if (current === null) return null;
    if (index !== 0) return current;
    const next = this.at(1);
    if (next !== null) return maybeRoundInDays(Math.floor((current + next) / 2));
    return maybeRoundInDays(Math.min(Math.floor((current * 3) / 2), current + DAY));
  }
  goodDelay(remaining: number) {
    return this.at(this.index(remaining) + 1);
  }
  currentDelay(remaining: number) {
    return this.at(this.index(remaining)) ?? 0;
  }
  remainingForGood(remaining: number) {
    return Math.max(this.steps.length - (this.index(remaining) + 1), 0);
  }
  remainingForFailed() {
    return this.steps.length;
  }
  isEmpty() {
    return this.steps.length === 0;
  }
}

function maybeRoundInDays(secs: number) {
  return secs > DAY ? round(secs / DAY) * DAY : secs;
}

// ---------- fuzz (states/fuzz.rs) ----------

function fuzzDelta(interval: number) {
  if (interval < 2.5) return 0;
  const ranges: Array<[number, number, number]> = [
    [2.5, 7, 0.15],
    [7, 20, 0.1],
    [20, Number.MAX_VALUE, 0.05],
  ];
  return ranges.reduce((delta, [start, end, factor]) => delta + factor * Math.max(Math.min(interval, end) - start, 0), 1);
}

export function constrainedFuzzBounds(interval: number, minimum: number, maximum: number): [number, number] {
  minimum = Math.min(minimum, maximum);
  interval = clamp(interval, minimum, maximum);
  const delta = fuzzDelta(interval);
  const lower = clamp(u32(round(interval - delta)), minimum, maximum);
  let upper = clamp(u32(round(interval + delta)), minimum, maximum);
  if (upper === lower && upper > 2 && upper < maximum) upper = lower + 1;
  return [lower, upper];
}

export function withReviewFuzz(factor: number | null, interval: number, minimum: number, maximum: number) {
  if (factor === null) return clamp(u32(round(interval)), minimum, maximum);
  const [lower, upper] = constrainedFuzzBounds(interval, minimum, maximum);
  return u32(Math.floor(lower + factor * (1 + upper - lower)));
}

function minimumReviewFuzzInterval(interval: number, previous: number, maximum: number) {
  const rounded = u32(round(interval));
  const [, upper] = constrainedFuzzBounds(interval, 1, maximum);
  if (rounded > previous) return previous + 1;
  if (previous <= upper) return previous;
  return 0;
}

// Deterministic per card and rep count, like Anki's seed (card id + reps).
export function fuzzFactor(cardId: number, reps: number): number {
  let state = (Math.floor(cardId) % 2 ** 32) ^ Math.imul(reps + 1, 0x9e3779b1);
  state = (state + Math.floor(cardId / 2 ** 32)) | 0;
  // mulberry32
  state = (state + 0x6d2b79f5) | 0;
  let t = Math.imul(state ^ (state >>> 15), 1 | state);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

// ---------- FSRS-6 (fsrs-rs model.rs / inference.rs) ----------

export const FSRS_DEFAULT_PARAMS = [
  0.212, 1.2931, 2.3065, 8.2956, 6.4133, 0.8334, 3.0194, 0.001, 1.8722, 0.1666, 0.796, 1.4835, 0.0614, 0.2629, 1.6483, 0.6014, 1.8729, 0.5425,
  0.0912, 0.0658, 0.1542,
];
const S_MIN = 0.001;
const S_MAX = 36500;

export function fsrsWeights(raw: number[]): number[] {
  let w: number[];
  if (raw.length === 0) w = [...FSRS_DEFAULT_PARAMS];
  else if (raw.length === 17) {
    w = [...raw];
    w[4] = f32(w[5]! * 2 + w[4]!);
    w[5] = f32(Math.log(f32(w[5]! * 3 + 1)) / 3);
    w[6] = f32(w[6]! + 0.5);
    w.push(0, 0, 0, 0.5);
  } else if (raw.length === 19) w = [...raw, 0, 0.5];
  else if (raw.length === 21) w = [...raw];
  else throw new Error("Anki deck options have invalid FSRS parameters");
  if (w.some((value) => !Number.isFinite(value))) throw new Error("Anki deck options have invalid FSRS parameters");
  // clip_parameters with num_relearning_steps = 1 and short-term off.
  const ceiling = 2;
  const clamps: Array<[number, number]> = [
    [S_MIN, 100], [S_MIN, 100], [S_MIN, 100], [S_MIN, 100], [1, 10], [0.001, 4], [0.001, 4], [0.001, 0.75], [0, 4.5], [0, 0.8], [0.001, 3.5],
    [0.001, 5], [0.001, 0.25], [0.001, 0.9], [0, 4], [0, 1], [1, 6], [0, ceiling], [0, ceiling], [0, 0.8], [0.1, 0.8],
  ];
  return w.map((value, index) => clamp(value, clamps[index]![0], clamps[index]![1]));
}

// What Anki stores as the card's decay (get_decay_from_params).
export function decayFromParams(raw: number[]) {
  if (raw.length === 0) return 0.1542;
  if (raw.length < 21) return 0.5;
  return raw[20]!;
}

function forgettingCurve(w: number[], t: number, s: number) {
  const decay = -w[20]!;
  const factor = Math.exp(Math.log(0.9) / decay) - 1;
  return (t / s * factor + 1) ** decay;
}

export function fsrsInterval(w: number[], stability: number, retention: number) {
  const decay = -w[20]!;
  const factor = Math.exp(Math.log(0.9) / decay) - 1;
  return (stability / factor) * (retention ** (1 / decay) - 1);
}

const initStability = (w: number[], rating: number) => w[Math.min(Math.max(rating - 1, 0), 3)]!;
const initDifficulty = (w: number[], rating: number) => w[4]! - Math.exp(w[5]! * Math.max(rating - 1, 0)) + 1;

function fsrsStep(w: number[], deltaT: number, rating: number, state: Memory, nth: number): Memory {
  const lastS = clamp(state.stability, S_MIN, S_MAX);
  const lastD = clamp(state.difficulty, 1, 10);
  const r = forgettingCurve(w, deltaT, lastS);
  const hardPenalty = rating === 2 ? w[15]! : 1;
  const easyBonus = rating === 4 ? w[16]! : 1;
  const success = lastS * (Math.exp(w[8]!) * (11 - lastD) * lastS ** -w[9]! * (Math.exp((1 - r) * w[10]!) - 1) * hardPenalty * easyBonus + 1);
  const failure = Math.min(
    w[11]! * lastD ** -w[12]! * ((lastS + 1) ** w[13]! - 1) * Math.exp((1 - r) * w[14]!),
    lastS / Math.exp(w[17]! * w[18]!),
  );
  const sinc = Math.exp(w[17]! * (rating - 3 + w[18]!)) * lastS ** -w[19]!;
  const shortTerm = lastS * (rating >= 2 ? Math.max(sinc, 1) : sinc);
  let newS = rating === 1 ? failure : success;
  if (deltaT === 0) newS = shortTerm;
  let newD = lastD + ((10 - lastD) * (-w[6]! * (rating - 3))) / 9;
  newD = clamp(w[7]! * (initDifficulty(w, 4) - newD) + newD, 1, 10);
  if (nth === 0 && state.stability === 0) {
    newS = initStability(w, rating);
    newD = clamp(initDifficulty(w, rating), 1, 10);
  }
  if (!Number.isFinite(newS) || !Number.isFinite(newD)) throw new Error("FSRS produced an invalid memory state");
  return { stability: clamp(newS, S_MIN, S_MAX), difficulty: newD };
}

interface FsrsItem {
  memory: Memory;
  interval: number;
}
interface FsrsNext {
  again: FsrsItem;
  hard: FsrsItem;
  good: FsrsItem;
  easy: FsrsItem;
}

export function fsrsNextStates(w: number[], memory: Memory | null, retention: number, daysElapsed: number): FsrsNext {
  const current = memory ?? { stability: 0, difficulty: 0 };
  const nth = memory ? 1 : 0;
  const item = (rating: number): FsrsItem => {
    const next = fsrsStep(w, daysElapsed, rating, current, nth);
    return { memory: next, interval: fsrsInterval(w, next.stability, retention) };
  };
  return { again: item(1), hard: item(2), good: item(3), easy: item(4) };
}

// ---------- state context (states/mod.rs) ----------

export interface Context {
  fuzz: number | null;
  fsrs: FsrsNext | null;
  fsrsShortTermWithSteps: boolean;
  fsrsAllowShortTerm: boolean;
  steps: Steps;
  relearnSteps: Steps;
  options: DeckOptions;
}

function minMax(ctx: Context, minimum: number): [number, number] {
  const maximum = Math.max(ctx.options.maximumReviewInterval, 1);
  return [clamp(minimum, 1, maximum), maximum];
}

const fuzzed = (ctx: Context, interval: number, minimum: number, maximum: number) => withReviewFuzz(ctx.fuzz, interval, minimum, maximum);

// ---------- learning (states/learning.rs) ----------

function learnNext(state: LearnState, ctx: Context): NextStates {
  const graduate = (rating: "again" | "hard" | "good", base: LearnState): CardState => {
    const memory = ctx.fsrs ? ctx.fsrs[rating].memory : null;
    const [minimum, maximum] = minMax(ctx, 1);
    let interval: number;
    let shortTerm = false;
    if (ctx.fsrs) {
      interval = ctx.fsrs[rating].interval;
      shortTerm = ctx.fsrsAllowShortTerm && (ctx.fsrsShortTermWithSteps || ctx.steps.isEmpty()) && interval < 0.5;
    } else interval = ctx.options.graduatingIntervalGood;
    if (shortTerm) return { ...base, scheduledSecs: u32(f32(interval * DAY)), memory };
    return review(fuzzed(ctx, Math.max(round(interval), 1), minimum, maximum), ctx.options.initialEase, memory);
  };

  const againDelay = ctx.steps.againDelay();
  const again: CardState =
    againDelay !== null
      ? { kind: "learn", remainingSteps: ctx.steps.remainingForFailed(), scheduledSecs: againDelay, memory: ctx.fsrs?.again.memory ?? null }
      : graduate("again", { kind: "learn", remainingSteps: ctx.steps.remainingForFailed(), scheduledSecs: 0, memory: null });

  const hardDelay = ctx.steps.hardDelay(state.remainingSteps);
  const hard: CardState =
    hardDelay !== null ? { ...state, scheduledSecs: hardDelay, memory: ctx.fsrs?.hard.memory ?? null } : graduate("hard", state);

  const goodDelay = ctx.steps.goodDelay(state.remainingSteps);
  const good: CardState =
    goodDelay !== null
      ? { kind: "learn", remainingSteps: ctx.steps.remainingForGood(state.remainingSteps), scheduledSecs: goodDelay, memory: ctx.fsrs?.good.memory ?? null }
      : graduate("good", state);

  let [minimum, maximum] = minMax(ctx, 1);
  let easyInterval: number;
  if (ctx.fsrs) {
    const goodDays = fuzzed(ctx, ctx.fsrs.good.interval, minimum, maximum);
    minimum = goodDays + 1;
    easyInterval = u32(Math.max(round(ctx.fsrs.easy.interval), 1));
  } else easyInterval = ctx.options.graduatingIntervalEasy;
  const easy = review(fuzzed(ctx, easyInterval, minimum, maximum), ctx.options.initialEase, ctx.fsrs?.easy.memory ?? null);
  return { again, hard, good, easy };
}

function review(scheduledDays: number, easeFactor: number, memory: Memory | null): ReviewState {
  return { kind: "review", scheduledDays, elapsedDays: 0, easeFactor, lapses: 0, leeched: false, memory };
}

// ---------- review (states/review.rs) ----------

function leechThresholdMet(lapses: number, threshold: number) {
  if (threshold <= 0) return false;
  const half = Math.max(Math.ceil(threshold / 2), 1);
  return lapses >= threshold && (lapses - threshold) % half === 0;
}

function failingReviewInterval(state: ReviewState, ctx: Context): [number, Memory | null] {
  if (ctx.fsrs) return [ctx.fsrs.again.interval, ctx.fsrs.again.memory];
  const [minimum, maximum] = minMax(ctx, ctx.options.minimumLapseInterval);
  return [fuzzed(ctx, f32(Math.max(state.scheduledDays, 1) * ctx.options.lapseMultiplier), minimum, maximum), null];
}

function constrainPassing(ctx: Context, interval: number, minimum: number, fuzz: boolean) {
  if (!ctx.fsrs) interval = f32(interval * ctx.options.intervalMultiplier);
  const [min, max] = minMax(ctx, minimum);
  return fuzz ? fuzzed(ctx, interval, min, max) : clamp(u32(round(interval)), min, max);
}

const daysLate = (state: ReviewState) => state.elapsedDays - state.scheduledDays;

function reviewNext(state: ReviewState, ctx: Context): NextStates {
  let hardDays: number;
  let goodDays: number;
  let easyDays: number;
  const o = ctx.options;
  if (ctx.fsrs) {
    const max = o.maximumReviewInterval;
    hardDays = constrainPassing(ctx, ctx.fsrs.hard.interval, Math.max(minimumReviewFuzzInterval(ctx.fsrs.hard.interval, state.scheduledDays, max), 1), true);
    goodDays = constrainPassing(ctx, ctx.fsrs.good.interval, Math.max(minimumReviewFuzzInterval(ctx.fsrs.good.interval, state.scheduledDays, max), hardDays + 1), true);
    easyDays = constrainPassing(ctx, ctx.fsrs.easy.interval, Math.max(minimumReviewFuzzInterval(ctx.fsrs.easy.interval, state.scheduledDays, max), goodDays + 1), true);
  } else if (daysLate(state) < 0) {
    const scheduled = Math.max(state.scheduledDays, 1);
    const elapsed = state.elapsedDays;
    hardDays = constrainPassing(ctx, Math.max(elapsed * o.hardMultiplier, scheduled * (o.hardMultiplier / 2)), 0, false);
    goodDays = constrainPassing(ctx, Math.max(elapsed * state.easeFactor, scheduled), 0, false);
    const reducedBonus = o.easyMultiplier - (o.easyMultiplier - 1) / 2;
    easyDays = constrainPassing(ctx, Math.max(elapsed * state.easeFactor, scheduled) * reducedBonus, 0, false);
  } else {
    const current = Math.max(state.scheduledDays, 1);
    const late = Math.max(daysLate(state), 0);
    const hardMinimum = o.hardMultiplier <= 1 ? 0 : state.scheduledDays + 1;
    hardDays = constrainPassing(ctx, current * o.hardMultiplier, hardMinimum, true);
    const goodMinimum = o.hardMultiplier <= 1 ? state.scheduledDays + 1 : hardDays + 1;
    goodDays = constrainPassing(ctx, (current + late / 2) * state.easeFactor, goodMinimum, true);
    easyDays = constrainPassing(ctx, (current + late) * state.easeFactor * o.easyMultiplier, goodDays + 1, true);
  }

  const lapses = state.lapses + 1;
  const leeched = leechThresholdMet(lapses, o.leechThreshold);
  const [failDays, failMemory] = failingReviewInterval(state, ctx);
  const againReview: ReviewState = {
    kind: "review",
    scheduledDays: u32(Math.max(round(failDays), 1)),
    elapsedDays: 0,
    easeFactor: Math.max(f32(state.easeFactor - 0.2), MINIMUM_EASE),
    lapses,
    leeched,
    memory: failMemory,
  };
  let again: CardState;
  const againDelay = ctx.relearnSteps.againDelay();
  if (againDelay !== null) {
    again = { kind: "relearn", learning: { kind: "learn", remainingSteps: ctx.relearnSteps.remainingForFailed(), scheduledSecs: againDelay, memory: failMemory }, review: againReview };
  } else if (ctx.fsrsAllowShortTerm && (ctx.fsrsShortTermWithSteps || ctx.relearnSteps.isEmpty()) && failDays < 0.5) {
    again = {
      kind: "relearn",
      learning: { kind: "learn", remainingSteps: ctx.relearnSteps.remainingForFailed(), scheduledSecs: u32(f32(failDays * DAY)), memory: failMemory },
      review: againReview,
    };
  } else again = againReview;

  return {
    again,
    hard: { ...state, scheduledDays: hardDays, elapsedDays: 0, easeFactor: Math.max(f32(state.easeFactor - 0.15), MINIMUM_EASE), memory: ctx.fsrs?.hard.memory ?? null },
    good: { ...state, scheduledDays: goodDays, elapsedDays: 0, memory: ctx.fsrs?.good.memory ?? null },
    easy: { ...state, scheduledDays: easyDays, elapsedDays: 0, easeFactor: f32(state.easeFactor + 0.15), memory: ctx.fsrs?.easy.memory ?? null },
  };
}

// ---------- relearning (states/relearning.rs) ----------

function relearnNext(state: RelearnState, ctx: Context): NextStates {
  const steps = ctx.relearnSteps;
  const shortTermOk = (interval: number) => ctx.fsrsAllowShortTerm && (ctx.fsrsShortTermWithSteps || steps.isEmpty()) && interval < 0.5;

  const [failDays, failMemory] = failingReviewInterval(state.review, ctx);
  let again: CardState;
  const againDelay = steps.againDelay();
  if (againDelay !== null) {
    again = {
      kind: "relearn",
      learning: { kind: "learn", remainingSteps: steps.remainingForFailed(), scheduledSecs: againDelay, memory: failMemory },
      review: { ...state.review, scheduledDays: u32(Math.max(round(failDays), 1)), elapsedDays: 0, memory: failMemory },
    };
  } else if (ctx.fsrs) {
    const [minimum, maximum] = minMax(ctx, 1);
    const interval = ctx.fsrs.again.interval;
    const againReview: ReviewState = { ...state.review, scheduledDays: fuzzed(ctx, Math.max(round(interval), 1), minimum, maximum), memory: failMemory };
    again = shortTermOk(interval)
      ? { kind: "relearn", learning: { kind: "learn", remainingSteps: steps.remainingForFailed(), scheduledSecs: u32(f32(interval * DAY)), memory: failMemory }, review: againReview }
      : againReview;
  } else again = state.review;

  const passing = (rating: "hard" | "good"): CardState => {
    const memory = ctx.fsrs ? ctx.fsrs[rating].memory : null;
    const delay = rating === "hard" ? steps.hardDelay(state.learning.remainingSteps) : steps.goodDelay(state.learning.remainingSteps);
    const remaining = rating === "hard" ? state.learning.remainingSteps : steps.remainingForGood(state.learning.remainingSteps);
    if (delay !== null) {
      return {
        kind: "relearn",
        learning: { kind: "learn", remainingSteps: remaining, scheduledSecs: delay, memory },
        review: { ...state.review, elapsedDays: 0, memory },
      };
    }
    if (ctx.fsrs) {
      const [minimum, maximum] = minMax(ctx, 1);
      const interval = ctx.fsrs[rating].interval;
      const nextReview: ReviewState = { ...state.review, scheduledDays: fuzzed(ctx, Math.max(round(interval), 1), minimum, maximum), memory };
      return shortTermOk(interval)
        ? { kind: "relearn", learning: { kind: "learn", remainingSteps: remaining, scheduledSecs: u32(f32(interval * DAY)), memory }, review: nextReview }
        : nextReview;
    }
    return state.review;
  };

  let easyDays: number;
  if (ctx.fsrs) {
    let [minimum, maximum] = minMax(ctx, 1);
    const goodDays = fuzzed(ctx, ctx.fsrs.good.interval, minimum, maximum);
    minimum = goodDays + 1;
    easyDays = fuzzed(ctx, Math.max(round(ctx.fsrs.easy.interval), 1), minimum, maximum);
  } else easyDays = state.review.scheduledDays + 1;
  const easy: ReviewState = { ...state.review, scheduledDays: easyDays, elapsedDays: 0, memory: ctx.fsrs?.easy.memory ?? null };

  return { again, hard: passing("hard"), good: passing("good"), easy };
}

export function nextStates(state: CardState, ctx: Context): NextStates {
  switch (state.kind) {
    case "new":
      return learnNext({ kind: "learn", remainingSteps: ctx.steps.remainingForFailed(), scheduledSecs: 0, memory: null }, ctx);
    case "learn":
      return learnNext(state, ctx);
    case "review":
      return reviewNext(state, ctx);
    case "relearn":
      return relearnNext(state, ctx);
  }
}

// ---------- card data JSON (storage/card/data.rs) ----------

export interface CardData {
  pos?: number;
  s?: number;
  d?: number;
  dr?: number;
  decay?: number;
  lrt?: number;
  cd?: string;
}

export function parseCardData(text: string): CardData {
  try {
    const value = JSON.parse(text || "{}");
    return value && typeof value === "object" ? value : {};
  } catch {
    return {};
  }
}

const places = (value: number, count: number) => {
  const factor = 10 ** count;
  return round(f32(value) * factor) / factor;
};

export function serialiseCardData(data: CardData): string {
  const out: Record<string, unknown> = {};
  if (data.pos !== undefined) out.pos = data.pos;
  if (data.s !== undefined) out.s = places(data.s, 4);
  if (data.d !== undefined) out.d = places(data.d, 3);
  if (data.dr !== undefined) out.dr = places(data.dr, 2);
  if (data.decay !== undefined) out.decay = places(data.decay, 3);
  if (data.lrt !== undefined) out.lrt = data.lrt;
  if (data.cd !== undefined && data.cd !== "" && data.cd !== "{}") out.cd = data.cd;
  return JSON.stringify(out);
}

export function memoryOf(data: CardData): Memory | null {
  return typeof data.s === "number" && typeof data.d === "number" ? { stability: data.s, difficulty: data.d } : null;
}

// ---------- current state (answering/current.rs) ----------

export function currentState(card: CardRow, options: DeckOptions, timing: Timing): CardState {
  const memory = memoryOf(parseCardData(card.data));
  const due = card.type === 2 ? Math.min(card.due, timing.daysElapsed) : card.due;
  const remaining = card.left % 1000;
  const ease = card.factor / 1000;
  switch (card.type) {
    case 0:
      return { kind: "new", position: Math.max(due, 0) };
    case 1:
      return { kind: "learn", remainingSteps: remaining, scheduledSecs: new Steps(options.learnSteps).currentDelay(remaining), memory };
    case 2:
      return {
        kind: "review",
        scheduledDays: card.ivl,
        elapsedDays: Math.max(card.ivl - (due - timing.daysElapsed), 0),
        easeFactor: ease,
        lapses: card.lapses,
        leeched: false,
        memory,
      };
    default:
      return {
        kind: "relearn",
        learning: { kind: "learn", remainingSteps: remaining, scheduledSecs: new Steps(options.relearnSteps).currentDelay(remaining), memory },
        review: { kind: "review", scheduledDays: card.ivl, elapsedDays: card.ivl, easeFactor: ease, lapses: card.lapses, leeched: false, memory },
      };
  }
}

export interface ContextInput {
  card: CardRow;
  options: DeckOptions;
  timing: Timing;
  fsrsEnabled: boolean;
  fsrsShortTermWithSteps: boolean;
  // Seconds of the card's last review (card data lrt, else latest revlog).
  lastReviewSecs: number | null;
}

// Returns null when FSRS is on but the card has no memory state yet: Anki
// then rebuilds it from the review history, which isn't ported.
export function buildContext(input: ContextInput): Context | null {
  const { card, options, timing } = input;
  let fsrs: FsrsNext | null = null;
  let allowShortTerm = false;
  if (input.fsrsEnabled) {
    const memory = memoryOf(parseCardData(card.data));
    if (!memory && card.type !== 0) return null;
    const weights = fsrsWeights(options.fsrsParams);
    const daysElapsed = input.lastReviewSecs === null ? 0 : u32(Math.floor(Math.max(timing.nextDayAt - input.lastReviewSecs, 0) / DAY));
    fsrs = fsrsNextStates(weights, memory, options.desiredRetention, daysElapsed);
    const raw = options.fsrsParams;
    allowShortTerm = raw.length >= 19 ? raw[17]! > 0 && raw[18]! > 0 : raw.length === 0;
  }
  return {
    fuzz: fuzzFactor(card.id, card.reps),
    fsrs,
    fsrsShortTermWithSteps: input.fsrsShortTermWithSteps,
    fsrsAllowShortTerm: allowShortTerm,
    steps: new Steps(options.learnSteps),
    relearnSteps: new Steps(options.relearnSteps),
    options,
  };
}

// ---------- intervals ----------

type IntervalKind = { secs: number } | { days: number };

function intervalKind(state: CardState): IntervalKind {
  switch (state.kind) {
    case "new":
      return { secs: 0 };
    case "learn":
      return { secs: state.scheduledSecs };
    case "review":
      return { days: state.scheduledDays };
    case "relearn":
      return { secs: state.learning.scheduledSecs };
  }
}

function maybeAsDays(kind: IntervalKind, secsUntilRollover: number): IntervalKind {
  if ("secs" in kind && kind.secs >= secsUntilRollover) return { days: Math.floor((kind.secs - secsUntilRollover) / DAY) + 1 };
  return kind;
}

const revlogInterval = (kind: IntervalKind) => ("days" in kind ? kind.days : -kind.secs);

// Seconds until the card would come back, for the answer button labels.
export function intervalSeconds(state: CardState, timing: Timing) {
  const kind = maybeAsDays(intervalKind(state), Math.max(timing.nextDayAt - timing.now, 0));
  return "days" in kind ? kind.days * DAY : kind.secs;
}

const reviewOf = (state: CardState): ReviewState | null => (state.kind === "review" ? state : state.kind === "relearn" ? state.review : null);

// ---------- applying an answer (answering/*.rs) ----------

export interface AnswerResult {
  card: CardRow;
  revlog: RevlogRow;
  leeched: boolean;
}

export function applyAnswer(
  card: CardRow,
  current: CardState,
  next: CardState,
  rating: 1 | 2 | 3 | 4,
  options: DeckOptions,
  timing: Timing,
  fsrsEnabled: boolean,
  answeredAtMs: number,
  takenMs: number,
  random: () => number = Math.random,
): AnswerResult {
  const out: CardRow = { ...card };
  const data = parseCardData(card.data);
  const secsUntilRollover = u32(Math.max(timing.nextDayAt - timing.now, 0));
  out.reps += 1;
  if (fsrsEnabled) data.dr = options.desiredRetention;
  else delete data.dr;
  if (fsrsEnabled) data.decay = decayFromParams(options.fsrsParams);
  const newPosition = current.kind === "new" ? current.position : null;

  const setMemory = (memory: Memory | null) => {
    if (memory) {
      data.s = memory.stability;
      data.d = memory.difficulty;
    } else {
      delete data.s;
      delete data.d;
    }
  };
  const learningDue = (kind: IntervalKind) => {
    if ("secs" in kind) {
      out.queue = 1;
      const upper = kind.secs + Math.min(Math.floor(f32(kind.secs * 0.25)), 300);
      const fuzzedSecs = kind.secs >= upper ? kind.secs : kind.secs + Math.floor(random() * (upper - kind.secs));
      out.due = Math.floor(answeredAtMs / 1000) + fuzzedSecs;
    } else {
      out.queue = 3;
      out.due = timing.daysElapsed + kind.days;
    }
  };

  let factorForRevlog: number;
  if (next.kind === "learn") {
    out.left = next.remainingSteps;
    out.type = 1;
    if (newPosition !== null) data.pos = newPosition;
    setMemory(next.memory);
    learningDue(maybeAsDays(intervalKind(next), secsUntilRollover));
    factorForRevlog = next.memory ? difficultyShifted(next.memory) : 0;
  } else if (next.kind === "review") {
    out.queue = 2;
    out.type = 2;
    out.ivl = next.scheduledDays;
    out.due = timing.daysElapsed + next.scheduledDays;
    out.factor = round(f32(next.easeFactor * 1000));
    out.lapses = next.lapses;
    out.left = 0;
    if (newPosition !== null) data.pos = newPosition;
    setMemory(next.memory);
    factorForRevlog = next.memory ? difficultyShifted(next.memory) : next.easeFactor;
  } else if (next.kind === "relearn") {
    out.ivl = next.review.scheduledDays;
    out.left = next.learning.remainingSteps;
    out.type = 3;
    out.lapses = next.review.lapses;
    out.factor = round(f32(next.review.easeFactor * 1000));
    if (newPosition !== null) data.pos = newPosition;
    setMemory(next.learning.memory);
    learningDue(maybeAsDays(intervalKind(next), secsUntilRollover));
    factorForRevlog = next.learning.memory ? difficultyShifted(next.learning.memory) : next.review.easeFactor;
  } else throw new Error("A card can't go back to new by answering");

  const leeched = reviewOf(next)?.leeched ?? false;
  if (leeched && options.leechSuspend) out.queue = -1;
  data.lrt = Math.floor(answeredAtMs / 1000);
  out.data = serialiseCardData(data);
  out.mod = Math.floor(answeredAtMs / 1000);
  out.usn = -1;

  const revlogType = current.kind === "new" || current.kind === "learn" ? 0 : current.kind === "relearn" ? 2 : daysLate(current) < 0 ? 3 : 1;
  const cap = options.capAnswerTimeSecs * 1000;
  const revlog: RevlogRow = {
    id: answeredAtMs,
    cid: card.id,
    usn: -1,
    ease: rating,
    ivl: revlogInterval(maybeAsDays(intervalKind(next), secsUntilRollover)),
    lastIvl: revlogInterval(maybeAsDays(intervalKind(current), secsUntilRollover)),
    factor: round(f32(factorForRevlog * 1000)),
    time: Math.max(0, Math.min(Math.round(takenMs), cap)),
    type: revlogType,
  };
  return { card: out, revlog, leeched };
}

function difficultyShifted(memory: Memory) {
  return f32((memory.difficulty - 1) / 9 + 0.1);
}

export const defaultDeckOptions = (): DeckOptions => ({
  learnSteps: [1, 10],
  relearnSteps: [10],
  graduatingIntervalGood: 1,
  graduatingIntervalEasy: 4,
  initialEase: INITIAL_EASE,
  easyMultiplier: 1.3,
  hardMultiplier: 1.2,
  lapseMultiplier: 0,
  intervalMultiplier: 1,
  maximumReviewInterval: 36500,
  minimumLapseInterval: 1,
  leechThreshold: 8,
  leechSuspend: false,
  capAnswerTimeSecs: 60,
  newPerDay: 20,
  reviewsPerDay: 200,
  buryNew: false,
  buryReviews: false,
  buryInterdayLearning: false,
  fsrsParams: [],
  desiredRetention: 0.9,
});
