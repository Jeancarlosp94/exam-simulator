/**
 * Text chunker for Claude context. Splits on paragraph boundaries first,
 * then falls back to character-window slicing when a single paragraph is
 * larger than the chunk size.
 *
 * Sprint 3 uses a character-count proxy for tokens (≈4 chars/token). We
 * over-shoot rather than under-shoot to stay within Claude's context
 * window in Sprint 4. Will move to js-tiktoken once we hit cost problems.
 */

export type Chunk = {
  index: number;
  content: string;
  /** Character count, not token count. See module JSDoc. */
  approxTokens: number;
};

type ChunkOptions = {
  /** Target chunk size in characters. */
  targetChars: number;
  /** Overlap in characters between consecutive chunks. */
  overlapChars: number;
};

const DEFAULTS: ChunkOptions = {
  targetChars: 12_000,
  overlapChars: 800,
};

export function chunkText(
  text: string,
  options?: Partial<ChunkOptions>,
): Chunk[] {
  const { targetChars, overlapChars } = { ...DEFAULTS, ...options };
  const normalized = text.replace(/\r\n/g, "\n").trim();
  if (normalized.length === 0) return [];

  if (normalized.length <= targetChars) {
    return [
      {
        index: 0,
        content: normalized,
        approxTokens: Math.ceil(normalized.length / 4),
      },
    ];
  }

  const paragraphs = normalized.split(/\n\s*\n/);
  const chunks: Chunk[] = [];
  let buffer = "";
  let chunkIndex = 0;

  const flush = (carryOverlap: boolean) => {
    if (buffer.length === 0) return;
    chunks.push({
      index: chunkIndex,
      content: buffer.trim(),
      approxTokens: Math.ceil(buffer.length / 4),
    });
    chunkIndex += 1;
    if (carryOverlap && overlapChars > 0) {
      buffer = buffer.slice(-overlapChars);
    } else {
      buffer = "";
    }
  };

  for (const paragraph of paragraphs) {
    if (paragraph.length > targetChars) {
      // Single paragraph exceeds the window: split it by sliding character window.
      flush(false);
      let pos = 0;
      while (pos < paragraph.length) {
        const slice = paragraph.slice(pos, pos + targetChars);
        chunks.push({
          index: chunkIndex,
          content: slice,
          approxTokens: Math.ceil(slice.length / 4),
        });
        chunkIndex += 1;
        if (pos + targetChars >= paragraph.length) break;
        pos += targetChars - overlapChars;
      }
      continue;
    }

    if (buffer.length + paragraph.length + 2 > targetChars) {
      flush(true);
    }
    buffer += (buffer.length === 0 ? "" : "\n\n") + paragraph;
  }

  flush(false);
  return chunks;
}
