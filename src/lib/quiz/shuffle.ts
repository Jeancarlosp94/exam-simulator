/**
 * Fisher-Yates shuffle in place over a copy of the input array.
 * Stable contract for tests: never mutates the input.
 */
export function fisherYates<T>(input: readonly T[]): T[] {
  const out = [...input];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const a = out[i];
    const b = out[j];
    if (a === undefined || b === undefined) continue;
    out[i] = b;
    out[j] = a;
  }
  return out;
}

/**
 * Build a quiz by sampling `count` items from `bank` (no repeats) and
 * optionally shuffling a nested array on each item via `shuffleField`.
 *
 * Generic on the question shape so this works for legacy CACES questions
 * (`opciones: string[]`), the extended clinical shape (`opciones: {label, text}[]`),
 * and the future Quizen shape (whatever Claude returns via tool_use).
 */
export function buildQuiz<T extends Record<string, unknown>>(
  bank: readonly T[],
  count: number,
  shuffleField?: keyof T,
): T[] {
  const safeCount = Math.max(0, Math.min(count, bank.length));
  const picked = fisherYates(bank).slice(0, safeCount);
  if (!shuffleField) return picked;
  return picked.map((question) => {
    const value = question[shuffleField];
    if (!Array.isArray(value)) return question;
    return { ...question, [shuffleField]: fisherYates(value) };
  });
}
