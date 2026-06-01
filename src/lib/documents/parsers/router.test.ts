/**
 * Parser router dispatch test. We mock each format-specific parser so we
 * can verify the router calls the right one without standing up unpdf,
 * mammoth, or tesseract.js.
 */

import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("./pdf", () => ({
  parsePdf: vi.fn(async () => ({
    text: "from-pdf",
    pageCount: 7,
    ocrUsed: false,
  })),
}));
vi.mock("./docx", () => ({
  parseDocx: vi.fn(async () => ({
    text: "from-docx",
    pageCount: 0,
    ocrUsed: false,
  })),
}));
vi.mock("./text", () => ({
  parseText: vi.fn(() => ({
    text: "from-text",
    pageCount: 0,
    ocrUsed: false,
  })),
}));

// Imports must come after vi.mock so the mocks are in place.
import { ParseError, parseDocument } from "./index";
import { parseDocx } from "./docx";
import { parsePdf } from "./pdf";
import { parseText } from "./text";

const EMPTY = new Uint8Array(0);

afterEach(() => {
  vi.clearAllMocks();
});

describe("parseDocument router", () => {
  it("routes .pdf to parsePdf", async () => {
    const result = await parseDocument(EMPTY, "pdf");
    expect(result.text).toBe("from-pdf");
    expect(parsePdf).toHaveBeenCalledOnce();
    expect(parseDocx).not.toHaveBeenCalled();
    expect(parseText).not.toHaveBeenCalled();
  });

  it("routes .docx to parseDocx", async () => {
    const result = await parseDocument(EMPTY, "docx");
    expect(result.text).toBe("from-docx");
    expect(parseDocx).toHaveBeenCalledOnce();
    expect(parsePdf).not.toHaveBeenCalled();
    expect(parseText).not.toHaveBeenCalled();
  });

  it("routes .txt to parseText", async () => {
    const result = await parseDocument(EMPTY, "txt");
    expect(result.text).toBe("from-text");
    expect(parseText).toHaveBeenCalledOnce();
  });

  it("routes .md to parseText", async () => {
    const result = await parseDocument(EMPTY, "md");
    expect(result.text).toBe("from-text");
    expect(parseText).toHaveBeenCalledOnce();
  });

  it("rejects unsupported extensions with a ParseError", async () => {
    await expect(parseDocument(EMPTY, "rtf")).rejects.toBeInstanceOf(
      ParseError,
    );
    await expect(parseDocument(EMPTY, null)).rejects.toBeInstanceOf(ParseError);
  });
});
