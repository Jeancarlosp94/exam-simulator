/**
 * PDF parser with OCR fallback for scanned documents.
 *
 * Flow:
 *  1. Verify magic bytes ("%PDF-") and refuse anything else.
 *  2. Open with unpdf, check page count vs MAX_PAGES.
 *  3. Race extractText against EXTRACT_TIMEOUT_MS.
 *  4. If text is empty (scanned doc), try OCR on the first
 *     MAX_OCR_PAGES pages via tesseract.js. OCR is bounded by
 *     OCR_TOTAL_TIMEOUT_MS — anything more would be slower than
 *     re-uploading a text PDF.
 *
 * Heavy deps (`tesseract.js`, `@napi-rs/canvas`) are dynamically imported
 * so a regular text PDF doesn't pay the cost.
 */

import { extractText, getDocumentProxy, renderPageAsImage } from "unpdf";

import { ParseError, type ParseResult } from "./types";

const PDF_MAGIC = [0x25, 0x50, 0x44, 0x46, 0x2d] as const; // "%PDF-"

const MAX_PAGES = 200;
const EXTRACT_TIMEOUT_MS = 45_000;

const MAX_OCR_PAGES = 5;
const OCR_TOTAL_TIMEOUT_MS = 50_000;
const OCR_SCALE = 2.0; // higher = sharper but slower

export async function parsePdf(buffer: Uint8Array): Promise<ParseResult> {
  if (!hasPdfMagic(buffer)) {
    throw new ParseError(
      "invalid_signature",
      "El archivo no parece ser un PDF válido (magic bytes incorrectos).",
    );
  }

  const pdf = await getDocumentProxy(buffer);
  const totalPages = pdf.numPages;

  if (totalPages > MAX_PAGES) {
    throw new ParseError(
      "too_many_pages",
      `PDF tiene ${totalPages} páginas (límite ${MAX_PAGES}).`,
      { pages: totalPages, limit: MAX_PAGES },
    );
  }

  let text: string;
  try {
    const result = await Promise.race([
      extractText(pdf, { mergePages: true }),
      timeoutAfter<never>(EXTRACT_TIMEOUT_MS, "extract_timeout"),
    ]);
    text = Array.isArray(result.text) ? result.text.join("\n\n") : result.text;
  } catch (err) {
    const message = err instanceof Error ? err.message : "pdf_parse_failed";
    if (message === "extract_timeout") {
      throw new ParseError("extract_timeout", message);
    }
    throw new ParseError("parse_failed", message);
  }

  if (text.trim().length > 0) {
    return { text, pageCount: totalPages, ocrUsed: false };
  }

  // Empty text → likely a scanned PDF. Try OCR.
  const ocrText = await runOcr(buffer, totalPages);
  if (ocrText.trim().length === 0) {
    throw new ParseError(
      "empty_text",
      "El PDF no contiene texto extraíble y OCR no recuperó nada legible.",
    );
  }
  return { text: ocrText, pageCount: totalPages, ocrUsed: true };
}

function hasPdfMagic(buffer: Uint8Array): boolean {
  if (buffer.length < PDF_MAGIC.length) return false;
  return PDF_MAGIC.every((byte, i) => buffer[i] === byte);
}

function timeoutAfter<T>(ms: number, errorMessage: string): Promise<T> {
  return new Promise<T>((_, reject) => {
    setTimeout(() => reject(new Error(errorMessage)), ms);
  });
}

/**
 * OCR up to MAX_OCR_PAGES of the PDF. Bound by OCR_TOTAL_TIMEOUT_MS so a
 * gnarly scan doesn't burn the entire serverless function budget. If the
 * canvas / tesseract deps can't load (e.g. serverless without the native
 * binary), we throw `ocr_failed` and the route surfaces a helpful message.
 */
async function runOcr(buffer: Uint8Array, totalPages: number): Promise<string> {
  let tesseractModule: typeof import("tesseract.js");
  try {
    tesseractModule = await import("tesseract.js");
  } catch (err) {
    throw new ParseError(
      "ocr_failed",
      `OCR no disponible: tesseract.js no pudo cargarse (${err instanceof Error ? err.message : "unknown"}).`,
    );
  }

  const pagesToOcr = Math.min(totalPages, MAX_OCR_PAGES);
  const deadline = Date.now() + OCR_TOTAL_TIMEOUT_MS;

  // One reusable worker — creating one per page would dominate runtime.
  let worker: Awaited<ReturnType<typeof tesseractModule.createWorker>>;
  try {
    worker = await tesseractModule.createWorker("spa+eng");
  } catch (err) {
    throw new ParseError(
      "ocr_failed",
      `OCR no disponible: no se pudo crear worker (${err instanceof Error ? err.message : "unknown"}).`,
    );
  }

  try {
    const pageTexts: string[] = [];
    for (let pageNumber = 1; pageNumber <= pagesToOcr; pageNumber++) {
      if (Date.now() > deadline) break;

      let imageBuffer: ArrayBuffer;
      try {
        imageBuffer = await renderPageAsImage(buffer, pageNumber, {
          scale: OCR_SCALE,
        });
      } catch (err) {
        // Most common: @napi-rs/canvas missing or platform-incompatible.
        throw new ParseError(
          "ocr_failed",
          `OCR no disponible: no se pudo renderizar la página ${pageNumber} (${err instanceof Error ? err.message : "canvas_error"}).`,
        );
      }

      const remaining = Math.max(0, deadline - Date.now());
      if (remaining === 0) break;

      try {
        const { data } = await Promise.race([
          worker.recognize(Buffer.from(imageBuffer)),
          timeoutAfter<never>(remaining, "ocr_page_timeout"),
        ]);
        pageTexts.push(data.text);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "ocr_recognize_failed";
        if (message === "ocr_page_timeout") break; // partial result is OK
        throw new ParseError("ocr_failed", message);
      }
    }
    return pageTexts.join("\n\n");
  } finally {
    try {
      await worker.terminate();
    } catch {
      /* worker termination errors don't matter — process is short-lived */
    }
  }
}
