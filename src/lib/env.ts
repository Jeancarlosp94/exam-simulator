/**
 * Lazy env access. Throws a clear error at the call site if a required
 * variable is missing — never at module load. This keeps `next dev` and
 * `next build` working before the user has wired up Supabase / Stripe.
 *
 * For exhaustive validation at startup, use Zod against process.env in
 * a dedicated boot script — but that's deferred until we actually need it.
 */

export function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value || value.trim().length === 0) {
    throw new Error(
      `Missing required env var: ${key}. Copy .env.example to .env.local and fill it in.`,
    );
  }
  return value;
}

export function optionalEnv(key: string, fallback: string): string {
  const value = process.env[key];
  return value && value.trim().length > 0 ? value : fallback;
}

/**
 * Try multiple env var names in order; return the first one that's set.
 * Throws a helpful error listing all candidates if none are populated.
 *
 * Use this for keys that have been renamed by upstream providers — e.g.
 * Supabase's `anon` → `publishable_key` transition or
 * `service_role` → `secret_key`.
 */
export function requireOneOf(...keys: string[]): string {
  for (const key of keys) {
    const value = process.env[key];
    if (value && value.trim().length > 0) return value;
  }
  throw new Error(
    `Missing required env var. Set one of: ${keys.join(", ")}. See .env.example.`,
  );
}

/** Public-side Supabase key — accepts both new ("publishable") and legacy ("anon") names. */
export function getSupabasePublishableKey(): string {
  return requireOneOf(
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  );
}

/** Server-only Supabase key — accepts both new ("secret") and legacy ("service_role") names. */
export function getSupabaseSecretKey(): string {
  return requireOneOf("SUPABASE_SECRET_KEY", "SUPABASE_SERVICE_ROLE_KEY");
}

/**
 * CLIENT-SAFE Supabase env access.
 *
 * Critical: `process.env[key]` with a dynamic key DOES NOT WORK in client
 * bundles because Next.js's SWC compiler can only inline NEXT_PUBLIC_*
 * vars when accessed STATICALLY (`process.env.X` as a literal). With
 * dynamic indexing the compiler leaves it as a runtime lookup, and in
 * the browser `process.env` is an empty object → undefined.
 *
 * These helpers reference the env vars by their literal property name
 * so SWC can inline them at build time.
 */
export function getClientSupabaseUrl(): string {
  const value = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!value || value.trim().length === 0) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL. Set it in .env and restart `npm run dev` (the client bundle is inlined at build time).",
    );
  }
  return value;
}

export function getClientSupabasePublishableKey(): string {
  // Static property access lets SWC replace each branch with its literal
  // value (or undefined) at compile time. ?? then picks the first that
  // was actually set when `next dev` started.
  const value =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!value || value.trim().length === 0) {
    throw new Error(
      "Missing Supabase publishable key. Set NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (or legacy NEXT_PUBLIC_SUPABASE_ANON_KEY) in .env and restart `npm run dev`.",
    );
  }
  return value;
}
