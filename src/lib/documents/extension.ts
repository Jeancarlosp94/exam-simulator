/**
 * File-type detection by storage_path extension.
 *
 * The documents table doesn't store mime_type — Storage already validates
 * the upload's contentType. Server-side we re-derive the type from the
 * storage_path so the route handler stays agnostic to what the client
 * claims about the file.
 */

export const SUPPORTED_EXTENSIONS = ["pdf", "docx", "txt", "md"] as const;

export type SupportedExtension = (typeof SUPPORTED_EXTENSIONS)[number];

/**
 * Returns the lowercase extension without the dot (e.g. "pdf"), or null
 * when the path has no recognizable extension. Strips query strings and
 * any trailing path noise.
 */
export function extractExtension(storagePath: string): string | null {
  if (typeof storagePath !== "string" || storagePath.length === 0) return null;
  const cleaned = storagePath.split("?")[0]?.split("#")[0] ?? "";
  const lastDot = cleaned.lastIndexOf(".");
  if (lastDot === -1 || lastDot === cleaned.length - 1) return null;
  const ext = cleaned.slice(lastDot + 1).toLowerCase();
  // Reject anything with non-alphanum (defends against `..jpg` or path traversal).
  if (!/^[a-z0-9]+$/.test(ext)) return null;
  return ext;
}

export function isSupportedExtension(
  ext: string | null,
): ext is SupportedExtension {
  if (ext === null) return false;
  return (SUPPORTED_EXTENSIONS as readonly string[]).includes(ext);
}

/**
 * Human-friendly badge label for the library list.
 */
export function extensionLabel(ext: string | null): string {
  if (!ext) return "Doc";
  return ext.toUpperCase();
}
