import { db } from "../src/db";
import { answerSession } from "../src/practice";

// Answers one exercise outside a real session: a one-question session around
// it, so tests can record attempts in a set order.
export function submitAttempt(userId: string, exerciseId: string, answer: unknown, durationMs?: number) {
  const { skill_id, tier } = db.query<{ skill_id: string; tier: number }, [string]>("SELECT skill_id, tier FROM exercises WHERE id = ?").get(exerciseId)!;
  const id = crypto.randomUUID();
  db.run(
    "INSERT INTO practice_sessions (id, user_id, skill_id, tier, hearts, hearts_left, queue_json, total, started_at) VALUES (?, ?, ?, ?, 9, 9, ?, 1, ?)",
    [id, userId, skill_id, tier, JSON.stringify([exerciseId]), new Date().toISOString()],
  );
  return answerSession(userId, id, exerciseId, answer, durationMs);
}
