/**
 * Request-level guards that every API route should apply. Centralized so
 * the policy is in one place and easy to audit.
 *
 *  - readJsonBody(request, maxBytes): parse JSON with an explicit size
 *    cap. Defends against DoS via huge bodies — Next's default limit is
 *    "no limit" beyond the platform's, which on Vercel is 4.5MB but we
 *    want much smaller for most routes.
 *  - logSecurityEvent(): structured log of security-relevant events
 *    (rate-limit hits, ownership failures, signature failures) so
 *    operators can spot patterns even without Sentry.
 */

const DEFAULT_MAX_BYTES = 32 * 1024; // 32 KB — plenty for normal API bodies

export class BodyTooLargeError extends Error {
  readonly statusCode = 413;
  constructor(public readonly limit: number) {
    super(`body exceeds ${limit} bytes`);
    this.name = "BodyTooLargeError";
  }
}

export class BodyInvalidJsonError extends Error {
  readonly statusCode = 400;
  constructor() {
    super("invalid_json");
    this.name = "BodyInvalidJsonError";
  }
}

/**
 * Read the request body as JSON with an explicit max-bytes cap. The cap
 * is enforced even when Content-Length is missing or lies — we read the
 * stream and bail as soon as we exceed the limit.
 *
 * Pass `maxBytes` large only for routes that legitimately accept large
 * payloads (none currently — all our routes take small JSON).
 */
export async function readJsonBody<T = unknown>(
  request: Request,
  maxBytes: number = DEFAULT_MAX_BYTES,
): Promise<T> {
  // Fast-fail on Content-Length when honest.
  const contentLength = request.headers.get("content-length");
  if (contentLength) {
    const n = Number.parseInt(contentLength, 10);
    if (Number.isFinite(n) && n > maxBytes) {
      throw new BodyTooLargeError(maxBytes);
    }
  }

  const body = request.body;
  if (!body) {
    try {
      return (await request.json()) as T;
    } catch {
      throw new BodyInvalidJsonError();
    }
  }

  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    received += value.byteLength;
    if (received > maxBytes) {
      reader.cancel().catch(() => {});
      throw new BodyTooLargeError(maxBytes);
    }
    chunks.push(value);
  }
  const buffer = new Uint8Array(received);
  let offset = 0;
  for (const c of chunks) {
    buffer.set(c, offset);
    offset += c.byteLength;
  }
  const text = new TextDecoder().decode(buffer);
  if (text.length === 0) {
    throw new BodyInvalidJsonError();
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new BodyInvalidJsonError();
  }
}

/**
 * Structured one-line log for security-relevant events. Lands in Vercel
 * logs (and Sentry/PostHog later when wired). Keep payloads small and
 * never include secrets or full PII — IDs only.
 */
export type SecurityEvent =
  | {
      kind: "rate_limit_hit";
      route: string;
      userId?: string;
      retryAfter: number;
    }
  | { kind: "auth_failed"; route: string }
  | {
      kind: "ownership_failed";
      route: string;
      userId: string;
      resource: string;
    }
  | { kind: "body_too_large"; route: string; limit: number }
  | { kind: "invalid_signature"; route: string; provider: string }
  | { kind: "suspicious_input"; route: string; reason: string };

export function logSecurityEvent(event: SecurityEvent) {
  console.warn(
    `[security] ${JSON.stringify({ ts: new Date().toISOString(), ...event })}`,
  );
}
