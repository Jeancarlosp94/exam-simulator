import { describe, expect, it } from "vitest";

import { parseText } from "./text";

const encoder = new TextEncoder();

describe("parseText", () => {
  it("decodes UTF-8 plain text", () => {
    const result = parseText(encoder.encode("hola mundo"));
    expect(result.text).toBe("hola mundo");
    expect(result.pageCount).toBe(0);
    expect(result.ocrUsed).toBe(false);
  });

  it("strips a leading UTF-8 BOM", () => {
    const withBom = new Uint8Array([0xef, 0xbb, 0xbf, ...encoder.encode("x")]);
    expect(parseText(withBom).text).toBe("x");
  });

  it("normalizes CRLF to LF", () => {
    const result = parseText(encoder.encode("a\r\nb\r\nc"));
    expect(result.text).toBe("a\nb\nc");
  });
});
