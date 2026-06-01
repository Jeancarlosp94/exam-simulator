/**
 * Plain text and markdown parser. Decodes UTF-8, strips an optional BOM,
 * and normalizes line endings so downstream chunking behaves like it does
 * for PDFs.
 */

import type { ParseResult } from "./types";

export function parseText(buffer: Uint8Array): ParseResult {
  const decoder = new TextDecoder("utf-8", { fatal: false });
  let text = decoder.decode(buffer);
  // Strip UTF-8 BOM if present — some Windows editors prepend it.
  if (text.charCodeAt(0) === 0xfeff) {
    text = text.slice(1);
  }
  text = text.replace(/\r\n/g, "\n");
  return { text, pageCount: 0, ocrUsed: false };
}
