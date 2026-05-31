import { PostHog } from "posthog-node";

/**
 * Server-side analytics helper. No-ops when POSTHOG_KEY is unset so
 * tests and local dev don't need a PostHog project.
 *
 * Use this for events that need to be reliably captured (signups,
 * conversions, billing) — the server fires them, no ad blockers in the
 * way. Client-side telemetry stays opt-in and lighter.
 *
 * IMPORTANT: PostHog's Node client queues events in memory. Always
 * `await flush()` in route handlers before returning, or events
 * may be dropped on Vercel's process recycle.
 */

let cached: PostHog | null = null;

function getClient(): PostHog | null {
  if (cached) return cached;
  const apiKey = process.env.POSTHOG_KEY ?? process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!apiKey) return null;
  cached = new PostHog(apiKey, {
    host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com",
    flushAt: 1, // ship immediately — serverless functions die after the response
    flushInterval: 0,
  });
  return cached;
}

export type AnalyticsEvent =
  | "user.signed_up"
  | "document.uploaded"
  | "document.extracted"
  | "quiz.generated"
  | "quiz.completed"
  | "review.completed"
  | "checkout.started"
  | "subscription.activated"
  | "subscription.canceled";

/**
 * Track a server-side event. Fire-and-forget — the caller doesn't await.
 * Errors are swallowed so analytics never breaks a request.
 */
export function track(
  event: AnalyticsEvent,
  userId: string,
  properties: Record<string, string | number | boolean | null> = {},
): void {
  const client = getClient();
  if (!client) return;
  try {
    client.capture({
      distinctId: userId,
      event,
      properties,
    });
  } catch {
    // Never let analytics break the caller.
  }
}

/**
 * Flush any queued events. Call this at the end of route handlers that
 * fired `track()` so events make it out before the function dies.
 */
export async function flushAnalytics(): Promise<void> {
  const client = getClient();
  if (!client) return;
  try {
    await client.shutdown(1000);
  } catch {
    // Swallow — best-effort.
  } finally {
    cached = null;
  }
}
