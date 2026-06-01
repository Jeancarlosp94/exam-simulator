import { describe, expect, it } from "vitest";

import {
  extensionLabel,
  extractExtension,
  isSupportedExtension,
} from "./extension";

describe("extractExtension", () => {
  it("returns lowercase extension from a storage path", () => {
    expect(extractExtension("user-id/doc.pdf")).toBe("pdf");
    expect(extractExtension("user-id/doc.DOCX")).toBe("docx");
    expect(extractExtension("user-id/notes.md")).toBe("md");
    expect(extractExtension("user-id/raw.TXT")).toBe("txt");
  });

  it("handles paths with multiple dots", () => {
    expect(extractExtension("user-id/2026.10.tax.pdf")).toBe("pdf");
  });

  it("strips query strings and fragments", () => {
    expect(extractExtension("foo.pdf?token=abc")).toBe("pdf");
    expect(extractExtension("foo.pdf#frag")).toBe("pdf");
  });

  it("returns null on missing or malformed extensions", () => {
    expect(extractExtension("")).toBeNull();
    expect(extractExtension("nofile")).toBeNull();
    expect(extractExtension("trailing.")).toBeNull();
    expect(extractExtension("weird.ext-with-dash")).toBeNull();
  });

  it("rejects non-string input safely", () => {
    // @ts-expect-error testing runtime guard
    expect(extractExtension(null)).toBeNull();
    // @ts-expect-error testing runtime guard
    expect(extractExtension(undefined)).toBeNull();
  });
});

describe("isSupportedExtension", () => {
  it("accepts only the supported set", () => {
    expect(isSupportedExtension("pdf")).toBe(true);
    expect(isSupportedExtension("docx")).toBe(true);
    expect(isSupportedExtension("txt")).toBe(true);
    expect(isSupportedExtension("md")).toBe(true);
  });

  it("rejects everything else", () => {
    expect(isSupportedExtension("doc")).toBe(false);
    expect(isSupportedExtension("rtf")).toBe(false);
    expect(isSupportedExtension("png")).toBe(false);
    expect(isSupportedExtension("")).toBe(false);
    expect(isSupportedExtension(null)).toBe(false);
  });
});

describe("extensionLabel", () => {
  it("uppercases known extensions", () => {
    expect(extensionLabel("pdf")).toBe("PDF");
    expect(extensionLabel("docx")).toBe("DOCX");
  });

  it("falls back to 'Doc' when extension is null", () => {
    expect(extensionLabel(null)).toBe("Doc");
  });
});
