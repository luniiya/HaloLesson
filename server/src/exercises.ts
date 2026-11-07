import { BLANK, type ExerciseType, type ExportExercise, type PracticeExercise } from "@halolesson/shared";

// What each exercise type keeps in exercises.content_json. The keys are the
// same as the ExportExercise / agent fields, so content moves between the
// database, files and agents unchanged.
const CONTENT_KEYS = {
  multiple_choice: ["options", "correctIndex"],
  free_text: ["answers"],
  order: ["items"],
  match: ["pairs"],
  fill_blanks: ["blanks"],
} as const satisfies Record<ExerciseType, readonly (keyof ExportExercise)[]>;

type Content = Pick<ExportExercise, "options" | "correctIndex" | "answers" | "items" | "pairs" | "blanks">;

const pick = (type: ExerciseType, source: Record<string, unknown>): Content =>
  Object.fromEntries((CONTENT_KEYS[type] ?? []).map((key) => [key, source[key]]));

// The content_json to store for an exercise.
export const contentJson = (exercise: ExportExercise) => JSON.stringify(pick(exercise.type, exercise as unknown as Record<string, unknown>));

const stringsOf = (value: unknown) => (Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []);
const pairsOf = (value: unknown) => (Array.isArray(value) ? value.filter((pair): pair is [string, string] => Array.isArray(pair) && typeof pair[0] === "string" && typeof pair[1] === "string") : []);
const blanksOf = (value: unknown) => (Array.isArray(value) ? value.map(stringsOf) : []);

// The answer fields of a stored exercise, with defaults for missing ones.
export function contentFields(type: ExerciseType, contentJsonText: string): Content {
  const content = JSON.parse(contentJsonText) as Record<string, unknown>;
  switch (type) {
    case "multiple_choice": return { options: stringsOf(content.options), correctIndex: typeof content.correctIndex === "number" ? content.correctIndex : 0 };
    case "free_text": return { answers: stringsOf(content.answers) };
    case "order": return { items: stringsOf(content.items) };
    case "match": return { pairs: pairsOf(content.pairs) };
    case "fill_blanks": return { blanks: blanksOf(content.blanks) };
  }
}

// Small seeded PRNG, so a question shows the same shuffle every time it is loaded.
function random(seed: string) {
  let state = 2166136261;
  for (let i = 0; i < seed.length; i++) state = Math.imul(state ^ seed.charCodeAt(i), 16777619);
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Shuffles, never handing back the answer order itself (when there is another).
export function shuffled<T>(items: T[], seed: string): T[] {
  const next = random(seed);
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [result[i], result[j]] = [result[j]!, result[i]!];
  }
  if (result.every((item, index) => item === items[index]) && new Set(items).size > 1) result.push(result.shift()!);
  return result;
}

// What the learner sees. `seed` keeps the shuffle stable within a session.
export function practiceFields(type: ExerciseType, contentJsonText: string, seed: string): Pick<PracticeExercise, "options" | "left"> {
  const content = contentFields(type, contentJsonText);
  switch (type) {
    case "multiple_choice": return { options: content.options! };
    case "order": return { options: shuffled(content.items!, seed) };
    case "match": return { left: content.pairs!.map(([left]) => left), options: shuffled(content.pairs!.map(([, right]) => right), seed) };
    default: return { options: [] };
  }
}

const normalize = (value: string) => value.trim().toLocaleLowerCase().replace(/\s+/g, " ");
const same = (a: unknown, b: string) => typeof a === "string" && normalize(a) === normalize(b);
const answerList = (answer: unknown, length: number) => (Array.isArray(answer) && answer.length === length ? answer : null);

// Fills each BLANK of a prompt with the matching value.
export const fillBlanks = (prompt: string, values: string[]) => prompt.split(BLANK).reduce((result, part, index) => result + (values[index - 1] ?? BLANK) + part);

// The right answer, as one line of text for the learner or an agent.
export function correctAnswerText(type: ExerciseType, prompt: string, contentJsonText: string): string {
  const content = contentFields(type, contentJsonText);
  switch (type) {
    case "multiple_choice": return content.options![content.correctIndex!] ?? "";
    case "free_text": return content.answers![0] ?? "";
    case "order": return content.items!.join(" → ");
    case "match": return content.pairs!.map(([left, right]) => `${left} → ${right}`).join("; ");
    case "fill_blanks": return fillBlanks(prompt, content.blanks!.map((answers) => answers[0] ?? ""));
  }
}

// What the learner answered, as text. Multiple choice answers are option indexes.
export function answerText(type: ExerciseType, prompt: string, contentJsonText: string, answer: unknown): unknown {
  const content = contentFields(type, contentJsonText);
  if (type === "multiple_choice") return typeof answer === "number" ? (content.options![answer] ?? answer) : answer;
  if (!Array.isArray(answer)) return answer;
  const values = answer.map(String);
  if (type === "order") return values.join(" → ");
  if (type === "match") return content.pairs!.map(([left], index) => `${left} → ${values[index] ?? "?"}`).join("; ");
  if (type === "fill_blanks") return fillBlanks(prompt, values);
  return answer;
}

// Answers: multiple_choice an option index; free_text a string; order the
// items in sequence; match the right item for each left one, in left order;
// fill_blanks one string per blank. Text compares ignoring case and spacing.
export function checkAnswer(type: ExerciseType, prompt: string, contentJsonText: string, answer: unknown): { correct: boolean; correctAnswer: string } {
  const content = contentFields(type, contentJsonText);
  const correctAnswer = correctAnswerText(type, prompt, contentJsonText);
  let correct = false;
  switch (type) {
    case "multiple_choice":
      correct = typeof answer === "number" && answer === content.correctIndex && answer < content.options!.length;
      break;
    case "free_text":
      correct = content.answers!.some((item) => same(answer, item));
      break;
    case "order": {
      const given = answerList(answer, content.items!.length);
      correct = Boolean(given?.every((item, index) => same(item, content.items![index]!)));
      break;
    }
    case "match": {
      const given = answerList(answer, content.pairs!.length);
      correct = Boolean(given?.every((item, index) => same(item, content.pairs![index]![1])));
      break;
    }
    case "fill_blanks": {
      const given = answerList(answer, content.blanks!.length);
      correct = Boolean(given?.every((item, index) => content.blanks![index]!.some((accepted) => same(item, accepted))));
      break;
    }
  }
  return { correct, correctAnswer };
}
