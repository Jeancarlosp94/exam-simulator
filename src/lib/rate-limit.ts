import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

import { envOrNull } from "@/lib/env";

/**
 * Upstash-backed rate limiter. Returns null when Upstash env vars are
 * absent OR look like placeholders from .env.example (e.g.
 * `https://<algo>.upstash.io`). Lets local dev work without configuring
 * Redis. Production must wire real Upstash creds to avoid burning AI
 * credits to abusers.
 */
function getRedis() {
  const url = envOrNull("UPSTASH_REDIS_REST_URL");
  const token = envOrNull("UPSTASH_REDIS_REST_TOKEN");
  if (!url || !token) return null;
  // Defense-in-depth: even if the placeholder check passes, validate the URL
  // so a malformed config doesn't blow up the request path.
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
  /** Window duration in @upstash/ratelimit Duration format, e.g. "1 h", "30 m". */
  window: `${number} ${"s" | "m" | "h" | "d"}`;
};

const cache = new Map<string, Ratelimit>();

export function getRateLimiter(config: RateLimitConfig): Ratelimit | null {
  const redis = getRedis();
  if (!redis) return null;

  const cacheKey = `${config.prefix}:${config.requests}:${config.window}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const limiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(config.requests, config.window),
    analytics: true,
    prefix: `quizen:${config.prefix}`,
  });
  cache.set(cacheKey, limiter);
  return limiter;
}

/**
 * Convenience: check the limiter for a user. Returns { ok: true } when
 * allowed (or when no limiter is configured), { ok: false, retryAfter }
 * when blocked.
 */
export async function checkRateLimit(
  config: RateLimitConfig,
  identifier: string,
): Promise<{ ok: true } | { ok: false; retryAfterSeconds: number }> {
  const limiter = getRateLimiter(config);
  if (!limiter) return { ok: true };

  const { success, reset } = await limiter.limit(identifier);
  if (success) return { ok: true };

  const retryAfterSeconds = Math.max(1, Math.ceil((reset - Date.now()) / 1000));
  return { ok: false, retryAfterSeconds };
}
