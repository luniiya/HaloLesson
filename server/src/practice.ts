import type { AttemptResult, PracticeSession } from "@halolesson/shared";
import { db } from "./db";

interface SkillRow {
  id: string;
  title: string;
  subject_id: string;
  subject_name: string;
}

interface ExerciseRow {
  id: string;
  type: "multiple_choice" | "free_text";
  prompt: string;
  content_json: string;
  explanation: string;
}

interface ProgressRow {
  mastery: number;
  correct_attempts: number;
  total_attempts: number;
}

export function getPracticeSession(userId: string, skillId: string): PracticeSession {
  const skill = db.query<SkillRow, [string, string]>(`
    SELECT skills.id, skills.title, subjects.id AS subject_id, subjects.name AS subject_name
    FROM skills JOIN units ON units.id = skills.unit_id JOIN subjects ON subjects.id = units.subject_id
    WHERE skills.id = ? AND subjects.user_id = ?
  `).get(skillId, userId);
  if (!skill) throw new Error("Skill not found");
  const exercises = db.query<ExerciseRow, [string]>("SELECT * FROM exercises WHERE skill_id = ? ORDER BY position, created_at").all(skillId);
  return {
    skillId: skill.id,
    skillTitle: skill.title,
    subjectId: skill.subject_id,
    subjectName: skill.subject_name,
    exercises: exercises.map((exercise) => {
      const content = JSON.parse(exercise.content_json) as { options?: unknown };
      return {
        id: exercise.id,
        type: exercise.type,
        prompt: exercise.prompt,
        options: exercise.type === "multiple_choice" && Array.isArray(content.options) ? content.options.filter((option): option is string => typeof option === "string") : [],
      };
    }),
  };
}

export function submitAttempt(userId: string, exerciseId: string, answer: unknown): AttemptResult {
  const exercise = db.query<ExerciseRow & { user_id: string; skill_id: string }, [string, string]>(`
    SELECT exercises.*, subjects.user_id FROM exercises
    JOIN skills ON skills.id = exercises.skill_id JOIN units ON units.id = skills.unit_id
    JOIN subjects ON subjects.id = units.subject_id WHERE exercises.id = ? AND subjects.user_id = ?
  `).get(exerciseId, userId);
  if (!exercise) throw new Error("Exercise not found");
  const content = JSON.parse(exercise.content_json) as { options?: unknown; correctIndex?: unknown; answers?: unknown };
  let correct = false;
  let correctAnswer = "";
  if (exercise.type === "multiple_choice") {
    const options = Array.isArray(content.options) ? content.options : [];
    const correctIndex = typeof content.correctIndex === "number" ? content.correctIndex : -1;
    correct = typeof answer === "number" && answer === correctIndex;
    correctAnswer = typeof options[correctIndex] === "string" ? options[correctIndex] : "";
  } else {
    const answers = Array.isArray(content.answers) ? content.answers.filter((item): item is string => typeof item === "string") : [];
    const normalize = (value: string) => value.trim().toLocaleLowerCase().replace(/\s+/g, " ");
    correct = typeof answer === "string" && answers.some((item) => normalize(item) === normalize(answer));
    correctAnswer = answers[0] ?? "";
  }

  const previous = db.query<ProgressRow, [string, string]>("SELECT mastery, correct_attempts, total_attempts FROM skill_progress WHERE user_id = ? AND skill_id = ?").get(userId, exercise.skill_id) ?? { mastery: 0, correct_attempts: 0, total_attempts: 0 };
  const mastery = Math.max(0, Math.min(1, correct ? previous.mastery + (1 - previous.mastery) * 0.22 : previous.mastery * 0.75));
  const stars = mastery >= 0.9 ? 3 : mastery >= 0.6 ? 2 : mastery >= 0.25 ? 1 : 0;
  db.transaction(() => {
    db.run("INSERT INTO attempts (id, user_id, exercise_id, answer_json, is_correct, created_at) VALUES (?, ?, ?, ?, ?, ?)", [crypto.randomUUID(), userId, exerciseId, JSON.stringify(answer ?? null), correct ? 1 : 0, new Date().toISOString()]);
    db.run(`INSERT INTO skill_progress (user_id, skill_id, stars, mastery, correct_attempts, total_attempts, last_practiced_at)
      VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(user_id, skill_id) DO UPDATE SET stars = excluded.stars,
      mastery = excluded.mastery, correct_attempts = excluded.correct_attempts, total_attempts = excluded.total_attempts,
      last_practiced_at = excluded.last_practiced_at`, [userId, exercise.skill_id, stars, mastery, previous.correct_attempts + (correct ? 1 : 0), previous.total_attempts + 1, new Date().toISOString()]);
  })();
  return { correct, correctAnswer, explanation: exercise.explanation, mastery, stars };
}
