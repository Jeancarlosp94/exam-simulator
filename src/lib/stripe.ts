import Stripe from "stripe";

import { requireEnv } from "@/lib/env";

let cached: Stripe | null = null;

/**
 * Lazy Stripe client. Reads STRIPE_SECRET_KEY at call site, not at import,
 * so `next dev` works before billing is wired up.
 *
 * NEVER import this from a "use client" module — the secret key would
 * end up in the client bundle.
 */
export function getStripeClient(): Stripe {
  if (cached) return cached;
  cached = new Stripe(requireEnv("STRIPE_SECRET_KEY"), {
    // Pin the API version so future Stripe upgrades are intentional, not
    // accidental from a dependabot bump. Update in lockstep with their changelog.
    apiVersion: "2026-05-27.dahlia",
    typescript: true,
  });
  return cached;
}
