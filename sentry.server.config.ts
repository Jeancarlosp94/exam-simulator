/**
 * Sentry server config. Captures unhandled errors from route handlers
 * and React Server Components. Imported by `instrumentation.ts`.
 *
 * Reads the SERVER-side DSN (no NEXT_PUBLIC_) so we can use a different
 * project for server vs browser if we want noise separation later.
 */
import * as Sentry from "@sentry/nextjs";

const dsn = process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    tracesSampleRate: 0.1,
    environment: process.env.VERCEL_ENV ?? "development",
  });
}
