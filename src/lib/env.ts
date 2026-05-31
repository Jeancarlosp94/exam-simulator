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
