// The web study queue for a mirrored Anki collection: deck counts, the next
// card, and answering. Answers are written to the mirror with usn -1 (Anki's
// "not synced yet" marker) and pushed by sync.ts.
//
// Differences from Anki's v3 queue builder, kept on purpose:
// - Limits come from the chosen deck (and its preset), not its parents.
// - Today's done counts come from the review log, so reviews from every
//   device count; the deck's own daily counters aren't updated.
// - Siblings are skipped for the day instead of being buried.
// - Filtered decks and cards in them are left out.
import type { Collection, DeckInfo } from "./collection";
import { renderCard } from "./render";
import {
  applyAnswer,
  buildContext,
  currentState,
  intervalSeconds,
  memoryOf,
  nextStates,
  parseCardData,
  type CardRow,
  type CardState,
  type DeckOptions,
  type Timing,
} from "./scheduler";

export interface DeckCounts {
  id: number;
  name: string;
  depth: number;
  newCount: number;
  learnCount: number;
  reviewCount: number;
}

export interface StudyCard {
  cardId: number;
  noteId: number;
  deckId: number;
  deckName: string;
  reps: number;
  mod: number;
  question: string;
  answer: string;
  css: string;
  ord: number;
  kind: CardState["kind"];
  // Seconds until the card comes back for Again, Hard, Good, Easy.
  intervals: [number, number, number, number];
}

export interface StudyQueue {
  deckId: number;
  deckName: string;
  counts: { newCount: number; learnCount: number; reviewCount: number };
  card: StudyCard | null;
  // Cards Anki has to prepare first (FSRS on, no memory state yet).
  skipped: number;
}

type Rating = 1 | 2 | 3 | 4;

function subtree(decks: DeckInfo[], deck: DeckInfo) {
  return decks.filter((entry) => !entry.filtered && (entry.id === deck.id || entry.name.startsWith(`${deck.name}::`)));
}

function limits(deck: DeckInfo, options: DeckOptions, timing: Timing) {
  const today = timing.daysElapsed;
  const review =
    deck.reviewLimitToday && deck.reviewLimitToday.today === today ? deck.reviewLimitToday.limit : (deck.reviewLimit ?? options.reviewsPerDay);
  const fresh = deck.newLimitToday && deck.newLimitToday.today === today ? deck.newLimitToday.limit : (deck.newLimit ?? options.newPerDay);
  return { review, fresh };
}

const placeholders = (count: number) => Array(count).fill("?").join(",");

interface Gathered {
  learnNow: CardRow[];
  learnAhead: CardRow[];
  reviews: CardRow[]; // reviews and interday learning, due today
  fresh: CardRow[];
  newLimit: number;
  reviewLimit: number;
  skipped: number;
}

function gather(col: Collection, deck: DeckInfo, decks: DeckInfo[], timing: Timing, options: DeckOptions, fsrs: boolean): Gathered {
  const ids = subtree(decks, deck).map((entry) => entry.id);
  const dayStartMs = (timing.nextDayAt - 86_400) * 1000;
  const inDecks = `did IN (${placeholders(ids.length)}) AND odid = 0`;

  const done = col.db
    .query<{ fresh: number; review: number }, number[]>(
      `SELECT
         coalesce(sum(CASE WHEN r.type = 0 AND r.lastIvl = 0 THEN 1 ELSE 0 END), 0) AS fresh,
         coalesce(sum(CASE WHEN r.type IN (1, 3) OR (r.type = 0 AND r.lastIvl > 0) OR (r.type = 2 AND r.lastIvl > 0) THEN 1 ELSE 0 END), 0) AS review
       FROM revlog r JOIN cards c ON c.id = r.cid
       WHERE r.id >= ? AND r.ease BETWEEN 1 AND 4 AND c.did IN (${placeholders(ids.length)})`,
    )
    .get(dayStartMs, ...ids)!;

  // Notes with a card answered today, for sibling skipping.
  const answeredNotes = new Set(
    col.db
      .query<{ nid: number }, number[]>(`SELECT DISTINCT c.nid FROM revlog r JOIN cards c ON c.id = r.cid WHERE r.id >= ? AND r.ease BETWEEN 1 AND 4`)
      .all(dayStartMs)
      .map((row) => row.nid),
  );
  const { review: reviewLimitRaw, fresh: newLimitRaw } = limits(deck, options, timing);
  let skipped = 0;
  const usable = (card: CardRow) => {
    if (!fsrs || card.type === 0) return true;
    if (memoryOf(parseCardData(card.data))) return true;
    skipped++;
    return false;
  };

  const learnNow: CardRow[] = [];
  const learnAhead: CardRow[] = [];
  for (const card of col.db.query<CardRow, number[]>(`SELECT * FROM cards WHERE ${inDecks} AND queue = 1 ORDER BY due, id`).all(...ids)) {
    if (!usable(card)) continue;
    if (card.due <= timing.now) learnNow.push(card);
    else if (card.due <= timing.now + col.learnAheadSecs()) learnAhead.push(card);
  }

  const reviewLimit = Math.max(reviewLimitRaw - done.review, 0);
  const reviews: CardRow[] = [];
  for (const card of col.db
    .query<CardRow, number[]>(`SELECT * FROM cards WHERE ${inDecks} AND queue IN (2, 3) AND due <= ? ORDER BY due, id`)
    .all(...ids, timing.daysElapsed)) {
    if (reviews.length >= reviewLimit) break;
    const sibling = answeredNotes.has(card.nid) && (card.queue === 2 ? options.buryReviews : options.buryInterdayLearning);
    if (sibling || !usable(card)) continue;
    reviews.push(card);
  }

  const ignoreReviewLimit = col.config<boolean>("newCardsIgnoreReviewLimit") === true;
  let newLimit = Math.max(newLimitRaw - done.fresh, 0);
  if (!ignoreReviewLimit) newLimit = Math.min(newLimit, Math.max(reviewLimit - reviews.length, 0));
  const fresh: CardRow[] = [];
  if (newLimit > 0) {
    const seenNotes = new Set<number>();
    for (const card of col.db.query<CardRow, number[]>(`SELECT * FROM cards WHERE ${inDecks} AND queue = 0 ORDER BY due, ord, id`).all(...ids)) {
      if (fresh.length >= newLimit) break;
      if (options.buryNew && (answeredNotes.has(card.nid) || seenNotes.has(card.nid))) continue;
      seenNotes.add(card.nid);
      fresh.push(card);
    }
  }
  return { learnNow, learnAhead, reviews, fresh, newLimit, reviewLimit, skipped };
}

export function findDeck(col: Collection, deckId: number) {
  const decks = col.decks();
  const deck = decks.find((entry) => entry.id === deckId);
  if (!deck) throw new Error("Anki deck not found");
  if (deck.filtered) throw new Error("Filtered decks can only be studied in Anki itself");
  return { deck, decks };
}

export function deckCounts(col: Collection, timing: Timing): DeckCounts[] {
  const decks = col.decks();
  const fsrs = col.fsrsEnabled();
  return decks
    .filter((deck) => !deck.filtered)
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((deck) => {
      const options = col.deckOptions(deck.configId ?? 1);
      const queue = gather(col, deck, decks, timing, options, fsrs);
      return {
        id: deck.id,
        name: deck.name,
        depth: deck.name.split("::").length - 1,
        newCount: queue.fresh.length,
        learnCount: queue.learnNow.length + queue.learnAhead.length + queue.reviews.filter((card) => card.queue === 3).length,
        reviewCount: queue.reviews.filter((card) => card.queue === 2).length,
      };
    })
    .filter((deck) => !(deck.name === "Default" && deck.id === 1 && emptyDefault(col)));
}

// Anki hides the Default deck when it's empty and other decks exist.
function emptyDefault(col: Collection) {
  return !col.db.query("SELECT 1 FROM cards WHERE did = 1 LIMIT 1").get() && (col.db.query<{ n: number }, []>("SELECT count(*) AS n FROM decks WHERE id != 1").get()?.n ?? 0) > 0;
}

function contextFor(col: Collection, card: CardRow, options: DeckOptions, timing: Timing) {
  const data = parseCardData(card.data);
  return buildContext({
    card,
    options,
    timing,
    fsrsEnabled: col.fsrsEnabled(),
    fsrsShortTermWithSteps: col.fsrsShortTermWithSteps(),
    lastReviewSecs: typeof data.lrt === "number" ? data.lrt : col.lastReviewSecs(card.id),
  });
}

// The card's home preset: its deck's, or the deck config for filtered cards.
function optionsForCard(col: Collection, decks: DeckInfo[], card: CardRow) {
  const deck = decks.find((entry) => entry.id === card.did);
  if (!deck || deck.filtered || card.odid) throw new Error("Cards in filtered decks can only be studied in Anki itself");
  return { deck, options: deckOptionsWithRetention(col, deck) };
}

function deckOptionsWithRetention(col: Collection, deck: DeckInfo): DeckOptions {
  const options = col.deckOptions(deck.configId ?? 1);
  // A deck's own desired retention overrides its preset (effective_desired_retention).
  return deck.desiredRetention !== null ? { ...options, desiredRetention: deck.desiredRetention } : options;
}

export function studyQueue(col: Collection, deckId: number, timing: Timing): StudyQueue {
  const { deck, decks } = findDeck(col, deckId);
  const options = col.deckOptions(deck.configId ?? 1);
  const queue = gather(col, deck, decks, timing, options, col.fsrsEnabled());
  const counts = {
    newCount: queue.fresh.length,
    learnCount: queue.learnNow.length + queue.learnAhead.length + queue.reviews.filter((card) => card.queue === 3).length,
    reviewCount: queue.reviews.filter((card) => card.queue === 2).length,
  };
  const next = queue.learnNow[0] ?? queue.reviews[0] ?? queue.fresh[0] ?? queue.learnAhead[0] ?? null;
  return { deckId: deck.id, deckName: deck.name, counts, card: next ? studyCard(col, decks, next, timing) : null, skipped: queue.skipped };
}

function studyCard(col: Collection, decks: DeckInfo[], card: CardRow, timing: Timing): StudyCard {
  const { deck, options } = optionsForCard(col, decks, card);
  const ctx = contextFor(col, card, options, timing);
  if (!ctx) throw new Error("Open Anki once so it can prepare this card for FSRS");
  const current = currentState(card, options, timing);
  const states = nextStates(current, ctx);
  const note = col.note(card.nid);
  if (!note) throw new Error("The card's note is missing");
  const notetype = col.notetypes().get(note.mid);
  if (!notetype) throw new Error("The card's note type is missing");
  const rendered = renderCard({ notetype, ord: card.ord, fields: note.flds.split("\x1f"), tags: note.tags, deckName: deck.name });
  return {
    cardId: card.id,
    noteId: card.nid,
    deckId: deck.id,
    deckName: deck.name,
    reps: card.reps,
    mod: card.mod,
    question: rendered.question,
    answer: rendered.answer,
    css: rendered.css,
    ord: card.ord,
    kind: current.kind,
    intervals: [states.again, states.hard, states.good, states.easy].map((state) => intervalSeconds(state, timing)) as StudyCard["intervals"],
  };
}

export interface AnswerInput {
  cardId: number;
  rating: Rating;
  // The card's reps when it was shown, so a stale answer is refused.
  reps: number;
  takenMs: number;
}

export function answer(col: Collection, input: AnswerInput, timing: Timing, nowMs: number) {
  if (![1, 2, 3, 4].includes(input.rating)) throw new Error("Rating must be 1 (again), 2 (hard), 3 (good) or 4 (easy)");
  const card = col.card(input.cardId);
  if (!card) throw new Error("Anki card not found");
  if (card.reps !== input.reps) throw new Error("This card changed since it was shown. Load the next card again");
  if (card.queue < 0) throw new Error("This card is suspended or buried");
  const decks = col.decks();
  const { options } = optionsForCard(col, decks, card);
  const ctx = contextFor(col, card, options, timing);
  if (!ctx) throw new Error("Open Anki once so it can prepare this card for FSRS");
  const current = currentState(card, options, timing);
  const states = nextStates(current, ctx);
  const next = [states.again, states.hard, states.good, states.easy][input.rating - 1]!;
  const takenMs = Math.max(0, Math.min(Math.round(Number(input.takenMs) || 0), 24 * 3600 * 1000));
  const result = applyAnswer(card, current, next, input.rating, options, timing, col.fsrsEnabled(), nowMs, takenMs);
  col.saveAnswer(result.card, result.revlog, result.leeched ? card.nid : null, Math.floor(nowMs / 1000));
  return { leeched: result.leeched, suspended: result.card.queue === -1 };
}
