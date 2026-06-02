/**
 * Compat alias for /api/documents/extract.
 *
 * Old clients (cached service workers, mobile shells, anything still
 * pointing at the PDF-only route) keep working unchanged. Remove once
 * traffic to this path falls to zero.
 *
 * Note: Next requires `runtime` and `maxDuration` to be statically
 * declared per route file, not re-exported. We mirror them here.
 */

import { POST as documentsPost } from "../../documents/extract/route";

export const runtime = "nodejs";
export const maxDuration = 60;

export function POST(request: Request) {
  return documentsPost(request);
}
