/**
 * SM-2 spaced-repetition algorithm — simplified implementation.
 *
 * Quality ratings (0-5):
 *   0  total blackout — couldn't even recognize the question
 *   1  incorrect with familiar feel
 *   2  incorrect but easy to remember in hindsight
 *   3  correct with serious difficulty
 *   4  correct after some hesitation
 *   5  perfect recall
 *
 * Quality < 3 → "lapse": reset repetitions, schedule for tomorrow,
 * penalize ease_factor slightly. Quality >= 3 → "review": increment
 * repetitions, grow interval geometrically by ease_factor.
 *
 * Quizen maps the binary quiz outcome to:
 *   correct   → 5
 *   incorrect → 1
 *
 * Reference: https://en.wikipedia.org/wiki/SuperMemo#Description_of_SM-2_algorithm
 */

export type Quality = 0 | 1 | 2 | 3 | 4 | 5;

export type SrsState = {
  ease_factor: number;
  interval_days: number;
  repetitions: number;
  next_review_at: string;
  last_reviewed_at: string | null;
};

const DEFAULT_EASE = 2.5;
const MIN_EASE = 1.3;

function addDays(now: Date, days: number): Date {
  const d = new Date(now);
  d.setDate(d.getDate() + days);
  return d;
}

/**
 * Compute the next SM-2 state from the previous state plus a quality rating.
 * Pure function — pass `now` explicitly so tests can control the clock.
 */
export function applySm2(
  prev: Pick<SrsState, "ease_factor" | "interval_days" | "repetitions"> | null,
  quality: Quality,
  now: Date = new Date(),
): SrsState {
  const ease = prev?.ease_factor ?? DEFAULT_EASE;
  const reps = prev?.repetitions ?? 0;
  const prevInterval = prev?.interval_days ?? 1;

  // Lapse: failed recall. Reset reps, schedule for tomorrow, slightly
  // reduce ease (but never below MIN_EASE).
  if (quality < 3) {
    const nextEase = Math.max(MIN_EASE, ease - 0.2);
    return {
      ease_factor: round2(nextEase),
      interval_days: 1,
      repetitions: 0,
      next_review_at: addDays(now, 1).toISOString(),
      last_reviewed_at: now.toISOString(),
    };
  }

  // Successful recall.
  const newReps = reps + 1;
  let newInterval: number;
  if (newReps === 1) {
    newInterval = 1;
  } else if (newReps === 2) {
    newInterval = 6;
  } else {
    newInterval = Math.max(1, Math.round(prevInterval * ease));
  }

  // SM-2's ease update: EF + 0.1 - (5-q)*(0.08 + (5-q)*0.02)
  const q = quality;
  const easeDelta = 0.1 - (5 - q) * (0.08 + (5 - q) * 0.02);
  const newEase = Math.max(MIN_EASE, ease + easeDelta);

  return {
    ease_factor: round2(newEase),
    interval_days: newInterval,
    repetitions: newReps,
    next_review_at: addDays(now, newInterval).toISOString(),
    last_reviewed_at: now.toISOString(),
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Coarse mapping from binary outcome to SM-2 quality. Used by /api/quiz/grade
 * and /api/review/answer when we don't ask the user for a self-rating.
 */
export function qualityFromCorrectness(isCorrect: boolean): Quality {
  return isCorrect ? 5 : 1;
}
