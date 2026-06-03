import type { FlashcardGeneration, QuizGeneration } from "@/lib/quiz/schemas";

/**
 * Provider-agnostic interface for quiz + flashcard generation.
 * Implementations live under src/lib/ai/providers/ and are picked by
 * AI_PROVIDER env var.
 *
 * Why an abstraction: lets us swap LLMs without touching the route
 * handler. Gemini for free-tier dev, Claude for production quality,
 * future Groq/OpenRouter/etc. plug in without churn.
 */

export type QuizGenerationInput = {
  /** Full document text — already chunked and joined by the route. */
  documentText: string;
  /** Number of questions to generate (5-30). */
  count: number;
  /** Overall difficulty target. */
  difficulty: "easy" | "mixed" | "hard";
};

export type QuizGenerationResult = {
  /** The parsed, schema-validated questions. */
  questions: QuizGeneration["questions"];
  /** Token usage for cost tracking. Some providers may report zero for unknown fields. */
  usage: {
    model: string;
    inputTokens: number;
    outputTokens: number;
    /** Cache hits — Anthropic supports prompt caching; Gemini reports cached_content_token_count. */
    cachedTokens: number;
  };
};

export type FlashcardGenerationInput = {
  documentText: string;
  /** Number of flashcards to generate (10-50). */
  count: number;
};

export type FlashcardGenerationResult = {
  flashcards: FlashcardGeneration["flashcards"];
  usage: {
    model: string;
    inputTokens: number;
    outputTokens: number;
    cachedTokens: number;
  };
};

export interface QuizGenerator {
  /** Human-readable provider name for logging + DB column generation_model. */
  readonly name: string;
  generate(input: QuizGenerationInput): Promise<QuizGenerationResult>;
  generateFlashcards(
    input: FlashcardGenerationInput,
  ): Promise<FlashcardGenerationResult>;
}

/** Thrown by providers when the model returns a response that doesn't match the schema. */
export class QuizGenerationError extends Error {
  readonly provider: string;
  override readonly cause?: unknown;

  constructor(message: string, provider: string, cause?: unknown) {
    super(`[${provider}] ${message}`);
    this.name = "QuizGenerationError";
    this.provider = provider;
    this.cause = cause;
  }
}
