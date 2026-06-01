/**
 * Compat alias for /api/documents/extract.
 *
 * Old clients (cached service workers, mobile shells, anything still
 * pointing at the PDF-only route) keep working unchanged. Remove once
 * traffic to this path falls to zero.
 */
export { POST, runtime, maxDuration } from "../../documents/extract/route";
