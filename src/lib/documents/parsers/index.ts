/**
 * Parser router. Given a file buffer and the storage_path extension,
 * dispatches to the right format-specific parser and returns a unified
 * `ParseResult`.
 *
 * The downstream pipeline (sanity ceiling, suspicion heuristic, chunk
 * insert) doesn't care which parser produced the text — it operates on
 * the result shape.
 */

import { isSupportedExtension, type SupportedExtension } from "../extension";
import { parseDocx } from "./docx";
import { parsePdf } from "./pdf";
import { parseText } from "./text";
import { ParseError, type ParseResult } from "./types";

export async function parseDocument(
  buffer: Uint8Array,
  extension: string | null,
): Promise<ParseResult> {
  if (!isSupportedExtension(extension)) {
    throw new ParseError(
      "parse_failed",
      `Formato no soportado: ${extension ?? "desconocido"}.`,
    );
  }
  return dispatch(buffer, extension);
}

async function dispatch(
  buffer: Uint8Array,
  extension: SupportedExtension,
): Promise<ParseResult> {
  switch (extension) {
    case "pdf":
      return parsePdf(buffer);
    case "docx":
      return parseDocx(buffer);
    case "txt":
    case "md":
      return parseText(buffer);
  }
}

export { ParseError, type ParseResult };
