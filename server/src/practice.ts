import { isTier, medalFor, TIER_LABELS, TIERS, type AttemptResult, type PracticeExercise, type PracticeSession, type SessionStatus } from "@halolesson/shared";
import { db } from "./db";
import { pickExercises } from "./recommender";
import { isSkillLocked } from "./skillGraph";

// A practice session plays one tier of a skill. Tiers open in order: the
// learner plays the first uncleared tier or replays a cleared one. Each wrong
// answer costs a heart and sends the exercise to the end of the queue; at zero
// hearts the session fails. Answering everything right clears the tier, and
// clearing Expert (again) makes the skill gold. Every answer is recorded
// whatever the outcome, so the recommender learns from failed sessions too.

interface SkillRow {
  id: string;
  title: string;
  subject_id: string;
  subject_name: string;
  session_size: number;
  hearts: number;
}

interface ExerciseRow {
  id: string;
  skill_id: string;
  type: "multiple_choice" | "free_text";
  prompt: string;
  content_json: string;
  explanation: string;
}

interface SessionRow {
  id: string;
  user_id: string;
  skill_id: string;
  tier: number;
  hearts: number;
  hearts_left: number;
  queue_json: string;
  total: number;
  done: number;
  answered: number;
  correct: number;
  status: SessionStatus;
}

interface ProgressRow {
  mastery: number;
  correct_attempts: number;
  total_attempts: number;
  tiers_cleared: number;
  expert_cleared_at: string | null;
}

function ownedSkill(userId: string, skillId: string): SkillRow {
  const skill = db.query<SkillRow, [string, string]>(`
    SELECT skills.id, skills.title, skills.session_size, skills.hearts, subjects.id AS subject_id, subjects.name AS subject_name
    FROM skills JOIN units ON units.id = skills.unit_id JOIN subjects ON subjects.id = units.subject_id
    WHERE skills.id = ? AND subjects.user_id = ?
  `).get(skillId, userId);
  if (!skill) throw new Error("Skill not found");
  return skill;
}

const progressOf = (userId: string, skillId: string): ProgressRow =>
  db.query<ProgressRow, [string, string]>("SELECT mastery, correct_attempts, total_attempts, tiers_cleared, expert_cleared_at FROM skill_progress WHERE user_id = ? AND skill_id = ?").get(userId, skillId)
  ?? { mastery: 0, correct_attempts: 0, total_attempts: 0, tiers_cleared: 0, expert_cleared_at: null };

function toPracticeExercise(row: ExerciseRow): PracticeExercise {
  const content = JSON.parse(row.content_json) as { options?: unknown };
  return {
    id: row.id,
    type: row.type,
    prompt: row.prompt,
    options: row.type === "multiple_choice" && Array.isArray(content.options) ? content.options.filter((option): option is string => typeof option === "string") : [],
  };
}

function toSession(row: SessionRow, skill: SkillRow): PracticeSession {
  const queue = JSON.parse(row.queue_json) as string[];
  const rows = new Map(
    db.query<ExerciseRow, [string]>("SELECT * FROM exercises WHERE id IN (SELECT value FROM json_each(?))").all(row.queue_json).map((exercise) => [exercise.id, exercise]),
  );
  return {
    id: row.id,
    skillId: skill.id,
    skillTitle: skill.title,
    subjectId: skill.subject_id,
    subjectName: skill.subject_name,
    tier: TIERS[row.tier] ?? "easy",
    hearts: row.hearts,
    heartsLeft: row.hearts_left,
    status: row.status,
    // Exercises deleted mid-session drop out of the queue.
    queue: queue.flatMap((id) => (rows.has(id) ? [toPracticeExercise(rows.get(id)!)] : [])),
    done: row.done,
    total: row.total,
    answered: row.answered,
    correct: row.correct,
  };
}

// Starts a session on `tier` (default: the first uncleared tier, or Expert
// once all are cleared). Ends any session the learner left open on the skill.
export function startSession(userId: string, skillId: string, tierInput?: unknown): PracticeSession {
  const skill = ownedSkill(userId, skillId);
  if (isSkillLocked(userId, skillId)) throw new Error("This skill is locked. Finish a skill linked to it to open it");
  if (tierInput !== undefined && tierInput !== null && !isTier(tierInput)) throw new Error(`Tier must be one of ${TIERS.join(", ")}`);
  const cleared = progressOf(userId, skillId).tiers_cleared;
  const open = Math.min(cleared, TIERS.length - 1);
  const tier = isTier(tierInput) ? TIERS.indexOf(tierInput) : open;
  if (tier > open) throw new Error(`Clear ${TIER_LABELS[TIERS[tier - 1]!]} first`);
  const queue = pickExercises(userId, skillId, tier, skill.session_size);
  if (!queue.length) throw new Error(`${TIER_LABELS[TIERS[tier]!]} has no exercises yet. Ask an agent to write some`);

  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  db.transaction(() => {
    db.run("UPDATE practice_sessions SET status = 'quit', ended_at = ? WHERE user_id = ? AND skill_id = ? AND status = 'active'", [now, userId, skillId]);
    db.run(
      "INSERT INTO practice_sessions (id, user_id, skill_id, tier, hearts, hearts_left, queue_json, total, started_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [id, userId, skillId, tier, skill.hearts, skill.hearts, JSON.stringify(queue), queue.length, now],
    );
  })();
  return getSession(userId, id);
}

function ownedSession(userId: string, sessionId: string): SessionRow {
  const row = db.query<SessionRow, [string, string]>("SELECT * FROM practice_sessions WHERE id = ? AND user_id = ?").get(sessionId, userId);
  if (!row) throw new Error("Session not found");
  return row;
}

export function getSession(userId: string, sessionId: string): PracticeSession {
  const row = ownedSession(userId, sessionId);
  return toSession(row, ownedSkill(userId, row.skill_id));
}

export function quitSession(userId: string, sessionId: string): PracticeSession {
  const row = ownedSession(userId, sessionId);
  if (row.status === "active") db.run("UPDATE practice_sessions SET status = 'quit', ended_at = ? WHERE id = ?", [new Date().toISOString(), sessionId]);
  return getSession(userId, sessionId);
}

function check(exercise: ExerciseRow, answer: unknown): { correct: boolean; correctAnswer: string } {
  const content = JSON.parse(exercise.content_json) as { options?: unknown; correctIndex?: unknown; answers?: unknown };
  if (exercise.type === "multiple_choice") {
    const options = Array.isArray(content.options) ? content.options : [];
    const correctIndex = typeof content.correctIndex === "number" ? content.correctIndex : -1;
    return { correct: typeof answer === "number" && answer === correctIndex, correctAnswer: typeof options[correctIndex] === "string" ? options[correctIndex] : "" };
  }
  const answers = Array.isArray(content.answers) ? content.answers.filter((item): item is string => typeof item === "string") : [];
  const normalize = (value: string) => value.trim().toLocaleLowerCase().replace(/\s+/g, " ");
  return { correct: typeof answer === "string" && answers.some((item) => normalize(item) === normalize(answer)), correctAnswer: answers[0] ?? "" };
}

// Longer than this, the learner walked away: the time isn't recorded.
const MAX_ANSWER_MS = 30 * 60 * 1000;

// Answers the session's current exercise (the head of its queue).
export function answerSession(userId: string, sessionId: string, exerciseId: unknown, answer: unknown, durationMs?: unknown): AttemptResult {
  const row = ownedSession(userId, sessionId);
  if (row.status !== "active") throw new Error("This session is over. Start a new one");
  const queue = JSON.parse(row.queue_json) as string[];
  if (queue[0] !== exerciseId) throw new Error("That isn't the current question");
  const exercise = db.query<ExerciseRow, [string]>("SELECT * FROM exercises WHERE id = ?").get(queue[0]);
  if (!exercise) throw new Error("Exercise not found");
  const { correct, correctAnswer } = check(exercise, answer);
  const retry = Boolean(db.query("SELECT 1 FROM attempts WHERE session_id = ? AND exercise_id = ?").get(sessionId, exercise.id));
  const duration = typeof durationMs === "number" && Number.isFinite(durationMs) && durationMs >= 0 && durationMs <= MAX_ANSWER_MS ? Math.round(durationMs) : null;

  queue.shift();
  if (!correct) queue.push(exercise.id);
  const heartsLeft = correct ? row.hearts_left : row.hearts_left - 1;
  const status: SessionStatus = heartsLeft <= 0 ? "failed" : queue.length === 0 ? "cleared" : "active";

  const previous = progressOf(userId, row.skill_id);
  // Mastery is the running estimate the statistics chart.
  const mastery = Math.max(0, Math.min(1, correct ? previous.mastery + (1 - previous.mastery) * 0.22 : previous.mastery * 0.75));
  // Clearing the next tier advances; replaying a cleared tier doesn't. Expert refreshes the medal.
  const tiersCleared = status === "cleared" && row.tier === previous.tiers_cleared ? previous.tiers_cleared + 1 : previous.tiers_cleared;
  const now = new Date().toISOString();
  const expertClearedAt = status === "cleared" && row.tier === TIERS.length - 1 ? now : previous.expert_cleared_at;

  db.transaction(() => {
    db.run(
      "INSERT INTO attempts (id, user_id, exercise_id, answer_json, is_correct, duration_ms, mastery_after, session_id, retry, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [crypto.randomUUID(), userId, exercise.id, JSON.stringify(answer ?? null), correct ? 1 : 0, duration, mastery, sessionId, retry ? 1 : 0, now],
    );
    db.run(`INSERT INTO skill_progress (user_id, skill_id, mastery, correct_attempts, total_attempts, last_practiced_at, tiers_cleared, expert_cleared_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(user_id, skill_id) DO UPDATE SET mastery = excluded.mastery,
      correct_attempts = excluded.correct_attempts, total_attempts = excluded.total_attempts, last_practiced_at = excluded.last_practiced_at,
      tiers_cleared = excluded.tiers_cleared, expert_cleared_at = excluded.expert_cleared_at`,
    [userId, row.skill_id, mastery, previous.correct_attempts + (correct ? 1 : 0), previous.total_attempts + 1, now, tiersCleared, expertClearedAt]);
    db.run(
      "UPDATE practice_sessions SET hearts_left = ?, queue_json = ?, done = done + ?, answered = answered + 1, correct = correct + ?, status = ?, ended_at = ? WHERE id = ?",
      [Math.max(0, heartsLeft), JSON.stringify(queue), correct ? 1 : 0, correct ? 1 : 0, status, status === "active" ? null : now, sessionId],
    );
  })();

  return {
    correct,
    correctAnswer,
    explanation: exercise.explanation,
    requeued: !correct && status !== "failed",
    session: getSession(userId, sessionId),
    tiersCleared,
    medal: medalFor(expertClearedAt),
  };
}
