/**
 * Next.js instrumentation hook. Runs once per server process startup —
 * the right place to wire Sentry (and any future OpenTelemetry exporter).
 *
 * Branches on NEXT_RUNTIME because Sentry has separate entry points for
 * the Node.js and Edge runtimes.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("../sentry.server.config");
  }
  // Edge runtime: no Sentry init yet — the proxy.ts middleware is the
  // only edge surface and it doesn't need explicit error capture (Next
  // forwards proxy errors to the next response).
}
