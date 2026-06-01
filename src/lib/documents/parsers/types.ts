/**
 * Shared parser result shape. `pageCount` is 0 for formats that don't
 * have a natural page concept (.docx, .txt, .md) — the documents.page_count
 * column is nullable so we just don't update it for those.
 */

export type ParseResult = {
  text: string;
  pageCount: number;
  /** True when text was reconstructed via OCR (scanned PDF fallback). */
  ocrUsed: boolean;
};

/** Parser-level errors that the route handler maps to HTTP responses. */
export class ParseError extends Error {
  constructor(
    public readonly code:
      | "too_many_pages"
      | "invalid_signature"
      | "empty_text"
      | "extract_timeout"
      | "ocr_failed"
      | "parse_failed",
    message: string,
    public readonly meta?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "ParseError";
  }
}
