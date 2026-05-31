import { describe, expect, it } from "vitest";

import { chunkText } from "./chunk";

describe("chunkText", () => {
  it("returns [] on empty input", () => {
    expect(chunkText("")).toEqual([]);
    expect(chunkText("   ")).toEqual([]);
  });

  it("returns a single chunk when text fits", () => {
    const text = "Short paragraph. Just a few words.";
    const chunks = chunkText(text);
    expect(chunks).toHaveLength(1);
    expect(chunks[0]?.content).toBe(text);
    expect(chunks[0]?.index).toBe(0);
  });

  it("splits on paragraph boundaries when text exceeds target", () => {
    const para = "A".repeat(8000);
    const text = `${para}\n\n${para}\n\n${para}`;
    const chunks = chunkText(text, { targetChars: 12_000, overlapChars: 200 });
    // 3 paragraphs of 8000 each = 24000 chars. With targetChars=12000 we
    // can fit at most one paragraph per chunk (since 2 paragraphs + \n\n
    // > 12000), so we expect 3 chunks.
    expect(chunks).toHaveLength(3);
    chunks.forEach((c, i) => expect(c.index).toBe(i));
  });

  it("uses sliding window for paragraphs larger than target", () => {
    // One paragraph longer than the chunk size — must split internally
    const giant = "X".repeat(30_000);
    const chunks = chunkText(giant, {
      targetChars: 10_000,
      overlapChars: 1000,
    });
    // Window step = target - overlap = 9000. Starting at 0:
    //   chunks at offsets 0, 9000, 18000, 27000 → 4 chunks
    expect(chunks.length).toBeGreaterThanOrEqual(3);
    // Index continuity
    chunks.forEach((c, i) => expect(c.index).toBe(i));
    // No chunk exceeds the target
    chunks.forEach((c) => expect(c.content.length).toBeLessThanOrEqual(10_000));
  });

  it("computes approxTokens as ceil(chars / 4)", () => {
    const text = "Hello world."; // 12 chars
    const chunks = chunkText(text);
    expect(chunks[0]?.approxTokens).toBe(3);
  });

  it("normalizes CRLF to LF before chunking", () => {
    const withCrlf = "Hello\r\n\r\nworld";
    const chunks = chunkText(withCrlf);
    expect(chunks).toHaveLength(1);
    expect(chunks[0]?.content).not.toContain("\r");
  });
});
