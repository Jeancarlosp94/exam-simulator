import { describe, expect, it } from "vitest";

import { generateShareSlug } from "./slug";

describe("generateShareSlug", () => {
  it("returns an 8-character string", () => {
    const slug = generateShareSlug();
    expect(slug).toHaveLength(8);
  });

  it("only uses the safe Crockford-ish alphabet", () => {
    const ALLOWED = /^[23456789abcdefghjkmnpqrstvwxyz]{8}$/;
    for (let i = 0; i < 200; i++) {
      expect(generateShareSlug()).toMatch(ALLOWED);
    }
  });

  it("produces unique slugs across many calls", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 1000; i++) seen.add(generateShareSlug());
    // With 32^8 possibilities, 1000 calls should never collide.
    expect(seen.size).toBe(1000);
  });
});
