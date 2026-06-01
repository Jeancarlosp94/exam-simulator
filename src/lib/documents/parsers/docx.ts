/**
 * .docx parser via `mammoth`. Mammoth is imported dynamically so the
 * dependency only loads in routes that actually parse Word documents
 * (keeps cold-start small on PDF-only requests).
 */

import { ParseError, type ParseResult } from "./types";

export async function parseDocx(buffer: Uint8Array): Promise<ParseResult> {
  let mammoth: typeof import("mammoth");
  try {
    mammoth = await import("mammoth");
  } catch (err) {
    throw new ParseError(
      "parse_failed",
      `mammoth failed to load: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  try {
    // mammoth wants a Node Buffer or { buffer: ArrayBuffer }. We give it
    // the underlying ArrayBuffer directly to avoid Buffer in code that
    // also runs in edge runtimes.
    const { value, messages } = await mammoth.extractRawText({
      buffer: Buffer.from(buffer),
    });
    if (messages.length > 0) {
      console.warn(
        "[docx-parser] mammoth messages:",
        messages.map((m) => m.message).join("; "),
      );
    }
    return {
      text: value.replace(/\r\n/g, "\n"),
      pageCount: 0,
      ocrUsed: false,
    };
  } catch (err) {
    throw new ParseError(
      "parse_failed",
      err instanceof Error ? err.message : "docx_parse_failed",
    );
  }
}
