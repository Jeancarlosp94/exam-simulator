/**
 * Sentry browser config. No-ops when NEXT_PUBLIC_SENTRY_DSN is unset so
 * local dev and self-hosted forks don't need a Sentry account to run.
 *
 * In production we capture unhandled errors + a small fraction of perf
 * traces. PII scrubbing is left at Sentry's defaults — we don't pass
 * the user's email or any chunk content into spans.
 */
import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    tracesSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
    replaysSessionSampleRate: 0,
    environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? "development",
  });
}
