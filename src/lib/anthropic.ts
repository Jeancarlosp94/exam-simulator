import Anthropic from "@anthropic-ai/sdk";

import { optionalEnv, requireEnv } from "@/lib/env";

/**
 * Default model for Quizen generations.
 *
 * Override per-call by reading `process.env.ANTHROPIC_MODEL` at the call site,
 * not by changing this constant — we want runtime configurability for
 * cost/quality A/B tests in Sprint 8 without redeploying.
 */
export const DEFAULT_MODEL = optionalEnv("ANTHROPIC_MODEL", "claude-opus-4-7");

let cached: Anthropic | null = null;

/**
 * Lazy-cached Anthropic client. The key is required at the call site, never
 * at import — keeps `next dev` working before .env.local is filled in.
 */
export function getAnthropicClient(): Anthropic {
  if (cached) return cached;
  cached = new Anthropic({
    apiKey: requireEnv("ANTHROPIC_API_KEY"),
  });
  return cached;
}
