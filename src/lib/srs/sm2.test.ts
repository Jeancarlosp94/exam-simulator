import { describe, expect, it } from "vitest";

import { applySm2, qualityFromCorrectness, type Quality } from "./sm2";

const NOW = new Date("2026-05-31T12:00:00.000Z");

function expectIsoDaysAhead(iso: string, days: number) {
  const expected = new Date(NOW);
  expected.setDate(expected.getDate() + days);
  expect(iso).toBe(expected.toISOString());
}

describe("applySm2", () => {
  describe("new card (prev=null)", () => {
    it("schedules first review 1 day out on quality=5", () => {
      const next = applySm2(null, 5, NOW);
      expect(next.repetitions).toBe(1);
      expect(next.interval_days).toBe(1);
      expectIsoDaysAhead(next.next_review_at, 1);
    });

    it("treats quality<3 as a lapse: reps reset, ease falls, 1 day out", () => {
      const next = applySm2(null, 1, NOW);
      expect(next.repetitions).toBe(0);
      expect(next.interval_days).toBe(1);
      expect(next.ease_factor).toBeLessThan(2.5);
      expect(next.ease_factor).toBeGreaterThanOrEqual(1.3);
      expectIsoDaysAhead(next.next_review_at, 1);
    });
  });

  describe("review progression on quality=5", () => {
    it("2nd rep is 6 days out", () => {
      const next = applySm2(
        { ease_factor: 2.6, interval_days: 1, repetitions: 1 },
        5,
        NOW,
      );
      expect(next.repetitions).toBe(2);
      expect(next.interval_days).toBe(6);
      expectIsoDaysAhead(next.next_review_at, 6);
    });

    it("3rd+ rep grows geometrically by ease_factor", () => {
      const next = applySm2(
        { ease_factor: 2.6, interval_days: 6, repetitions: 2 },
        5,
        NOW,
      );
      expect(next.repetitions).toBe(3);
      // 6 * 2.6 = 15.6 → rounded to 16
      expect(next.interval_days).toBe(16);
      expectIsoDaysAhead(next.next_review_at, 16);
    });
  });

  describe("lapse handling", () => {
    it("resets repetitions on quality<3 regardless of prior progress", () => {
      const next = applySm2(
        { ease_factor: 2.8, interval_days: 30, repetitions: 5 },
        2, // still <3, still a lapse
        NOW,
      );
      expect(next.repetitions).toBe(0);
      expect(next.interval_days).toBe(1);
      expect(next.ease_factor).toBe(2.6); // 2.8 - 0.2
    });
  });

  describe("ease floor", () => {
    it("never drops below 1.3 even after repeated lapses", () => {
      let state: ReturnType<typeof applySm2> = applySm2(null, 1, NOW);
      // Hammer it with bad ratings; ease should converge to 1.3
      for (let i = 0; i < 30; i += 1) {
        state = applySm2(state, 1, NOW);
      }
      expect(state.ease_factor).toBe(1.3);
    });
  });

  describe("ease update on success", () => {
    it("rises slightly on quality=5", () => {
      const next = applySm2(
        { ease_factor: 2.5, interval_days: 6, repetitions: 2 },
        5,
        NOW,
      );
      // EF + 0.1 - (5-5)*(...) = 2.5 + 0.1 = 2.6
      expect(next.ease_factor).toBe(2.6);
    });

    it("falls slightly on quality=3 (still a pass)", () => {
      const next = applySm2(
        { ease_factor: 2.5, interval_days: 6, repetitions: 2 },
        3,
        NOW,
      );
      // EF + 0.1 - 2*(0.08 + 2*0.02) = 2.5 + 0.1 - 0.24 = 2.36
      expect(next.ease_factor).toBe(2.36);
    });
  });

  describe("qualityFromCorrectness", () => {
    it.each([
      [true, 5 as Quality],
      [false, 1 as Quality],
    ])("maps %p to %i", (isCorrect, expected) => {
      expect(qualityFromCorrectness(isCorrect)).toBe(expected);
    });
  });

  describe("last_reviewed_at", () => {
    it("stamps the provided now() on every call", () => {
      const next = applySm2(null, 5, NOW);
      expect(next.last_reviewed_at).toBe(NOW.toISOString());
    });
  });
});
