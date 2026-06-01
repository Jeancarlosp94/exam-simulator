import { optionalEnv } from "@/lib/env";

import { createAnthropicQuizGenerator } from "./providers/anthropic";
import { createGeminiQuizGenerator } from "./providers/gemini";
import type { QuizGenerator } from "./types";

/**
 * Pick the AI provider for quiz generation based on the AI_PROVIDER env
 * var. Defaults to Gemini because it has a free tier — Claude Opus 4.7
 * costs $5/$25 per 1M tokens with no free tier.
 *
 * Switch via .env without code changes:
 *   AI_PROVIDER=gemini     # free tier, default
 *   AI_PROVIDER=anthropic  # claude-opus-4-7, paid
 *
 * Each provider has its own env requirements:
 *   gemini    → GEMINI_API_KEY (+ optional GEMINI_MODEL)
 *   anthropic → ANTHROPIC_API_KEY (+ optional ANTHROPIC_MODEL)
 */
export type AIProvider = "gemini" | "anthropic";

export function getQuizGenerator(): QuizGenerator {
  const provider = optionalEnv("AI_PROVIDER", "gemini") as AIProvider;
  switch (provider) {
    case "anthropic":
      return createAnthropicQuizGenerator();
    case "gemini":
      return createGeminiQuizGenerator();
    default:
      throw new Error(
        `Unknown AI_PROVIDER: "${provider}". Use "gemini" or "anthropic".`,
      );
  }
}

export type {
  QuizGenerationInput,
  QuizGenerationResult,
  QuizGenerator,
} from "./types";

export { QuizGenerationError } from "./types";
