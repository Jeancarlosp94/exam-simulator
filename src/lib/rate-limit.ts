import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

import { envOrNull } from "@/lib/env";

/**
 * Rate limiter with two tiers:
 *
 *   1. Upstash (distributed). Production-ready when UPSTASH_REDIS_REST_URL
 *      and UPSTASH_REDIS_REST_TOKEN are configured. Sliding window across
 *      all serverless instances.
 *
 *   2. In-memory fallback. When Upstash isn't configured, we still limit
 *      per-process so production never runs unbounded. Vercel rotates
 *      instances so attackers can partially evade this by warming many
 *      functions in parallel — but it raises the cost of abuse from
 *      "trivial" to "noticeable". Operators get a one-shot startup
 *      warning so the missing Upstash config isn't silent.
 *
 * Both tiers expose the same interface; the route handler always sees
 * { ok: true } or { ok: false, retryAfterSeconds }.
 */

let inMemoryWarned = false;

function getRedis() {
  const url = envOrNull("UPSTASH_REDIS_REST_URL");
  const token = envOrNull("UPSTASH_REDIS_REST_TOKEN");
  if (!url || !token) return null;
  try {
    new URL(url);
  } catch {
    return null;
  }
  return new Redis({ url, token });
}

type RateLimitConfig = {
  /** Unique identifier for this limiter, becomes the Redis key prefix. */
  prefix: string;
  /** Number of requests allowed in the window. */
  requests: number;
  /** Window duration, e.g. "1 h", "30 m". */
  window: `${number} ${"s" | "m" | "h" | "d"}`;
};

const upstashCache = new Map<string, Ratelimit>();

function getUpstashLimiter(config: RateLimitConfig): Ratelimit | null {
  const redis = getRedis();
  if (!redis) return null;
  const cacheKey = `${config.prefix}:${config.requests}:${config.window}`;
  const cached = upstashCache.get(cacheKey);
  if (cached) return cached;
  const limiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(config.requests, config.window),
    analytics: true,
    prefix: `quizen:${config.prefix}`,
  });
  upstashCache.set(cacheKey, limiter);
  return limiter;
}

// ─── In-memory fallback ──────────────────────────────────────────────
// Per-key array of UNIX-millisecond timestamps. Old entries pruned on
// every check. Memory is bounded by (active keys × requests per window).
// At our scales (~100 users × ~10 routes × 30 requests each) this is
// trivial. The Map is per-Node-process; on Vercel each warm function
// has its own.

const memoryBuckets = new Map<string, number[]>();

const WINDOW_TO_MS: Record<"s" | "m" | "h" | "d", number> = {
  s: 1_000,
  m: 60_000,
  h: 3_600_000,
  d: 86_400_000,
};

function parseWindowMs(window: RateLimitConfig["window"]): number {
  const [num, unit] = window.split(" ") as [string, "s" | "m" | "h" | "d"];
  const n = Number.parseInt(num, 10);
  return n * WINDOW_TO_MS[unit];
}

function checkInMemory(
  config: RateLimitConfig,
  identifier: string,
): { ok: true } | { ok: false; retryAfterSeconds: number } {
  if (!inMemoryWarned) {
    inMemoryWarned = true;
    console.warn(
      "[rate-limit] Using in-memory fallback (Upstash not configured). " +
        "Production should set UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN.",
    );
  }
  const key = `${config.prefix}:${identifier}`;
  const now = Date.now();
  const windowMs = parseWindowMs(config.window);
  const cutoff = now - windowMs;

  const existing = memoryBuckets.get(key) ?? [];
  const fresh = existing.filter((t) => t > cutoff);

  if (fresh.length >= config.requests) {
    const oldest = fresh[0]!;
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((oldest + windowMs - now) / 1000),
    );
    memoryBuckets.set(key, fresh);
    return { ok: false, retryAfterSeconds };
  }

  fresh.push(now);
  memoryBuckets.set(key, fresh);
  return { ok: true };
}

// Periodic eviction of completely-expired keys to keep memory bounded.
// We piggy-back on the check itself: every Nth check, scan and prune.
let opsSinceSweep = 0;
const SWEEP_EVERY = 200;
function maybeSweepMemory() {
  opsSinceSweep++;
  if (opsSinceSweep < SWEEP_EVERY) return;
  opsSinceSweep = 0;
  const now = Date.now();
  // Use the longest window we know about (24h) as the eviction threshold.
  const maxWindow = WINDOW_TO_MS.d;
  for (const [key, timestamps] of memoryBuckets) {
    if (
      timestamps.length === 0 ||
      timestamps[timestamps.length - 1]! < now - maxWindow
    ) {
      memoryBuckets.delete(key);
    }
  }
}

/**
 * Check the limiter for a user. Returns { ok: true } when allowed,
 * { ok: false, retryAfter } when blocked. Always rate-limits in
 * production — falls back to in-memory if Upstash isn't configured.
 */
export async function checkRateLimit(
  config: RateLimitConfig,
  identifier: string,
): Promise<{ ok: true } | { ok: false; retryAfterSeconds: number }> {
  maybeSweepMemory();

  const upstash = getUpstashLimiter(config);
  if (upstash) {
    try {
      const { success, reset } = await upstash.limit(identifier);
      if (success) return { ok: true };
      const retryAfterSeconds = Math.max(
        1,
        Math.ceil((reset - Date.now()) / 1000),
      );
      return { ok: false, retryAfterSeconds };
    } catch (err) {
      // Upstash transient errors fall through to in-memory rather than
      // failing open (which would let abuse through during outages).
      console.warn(
        "[rate-limit] Upstash error, using in-memory fallback for this request:",
        err instanceof Error ? err.message : err,
      );
    }
  }

  return checkInMemory(config, identifier);
}

/**
 * Standard 429 response shape — every route handler that hits a limit
 * returns this so the client + Retry-After header are consistent.
 */
export function rateLimitedResponse(retryAfterSeconds: number) {
  return {
    body: {
      error: "rate_limited" as const,
      retry_after_seconds: retryAfterSeconds,
    },
    init: {
      status: 429,
      headers: { "Retry-After": String(retryAfterSeconds) },
    },
  };
}
