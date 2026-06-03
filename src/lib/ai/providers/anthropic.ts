import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";

import { DEFAULT_MODEL, getAnthropicClient } from "@/lib/anthropic";
import {
  buildFlashcardPrompt,
  FLASHCARD_SYSTEM_PROMPT,
} from "@/lib/quiz/flashcard-prompts";
import { buildUserPrompt, SYSTEM_PROMPT } from "@/lib/quiz/prompts";
import {
  FlashcardGenerationSchema,
  QuizGenerationSchema,
} from "@/lib/quiz/schemas";

import {
  QuizGenerationError,
  type FlashcardGenerationInput,
  type FlashcardGenerationResult,
  type QuizGenerationInput,
  type QuizGenerationResult,
  type QuizGenerator,
} from "../types";

/**
 * Anthropic Claude provider. Uses claude-opus-4-7 by default with
 * adaptive thinking + structured outputs (zodOutputFormat) and prompt
 * caching on system + document blocks.
 *
 * Cost reference (2026): Opus 4.7 = $5/$25 per 1M tokens, Haiku 4.5 =
 * $1/$5. Cached input tokens read at ~10% of base rate.
 */
export function createAnthropicQuizGenerator(): QuizGenerator {
  return {
    name: `anthropic:${DEFAULT_MODEL}`,

    async generate({
      documentText,
      count,
      difficulty,
    }: QuizGenerationInput): Promise<QuizGenerationResult> {
      const anthropic = getAnthropicClient();
      try {
        const response = await anthropic.messages.parse({
          model: DEFAULT_MODEL,
          max_tokens: 16000,
          thinking: { type: "adaptive" },
          output_config: {
            effort: "high",
            format: zodOutputFormat(QuizGenerationSchema),
          },
          system: [
            {
              type: "text",
              text: SYSTEM_PROMPT,
              cache_control: { type: "ephemeral" },
            },
          ],
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: `<document>\n${documentText}\n</document>`,
                  cache_control: { type: "ephemeral" },
                },
                {
                  type: "text",
                  text: buildUserPrompt({
                    documentText: "(see prior block)",
                    count,
                    difficulty,
                  }).replace(/<document>[\s\S]*?<\/document>\n\n/, ""),
                },
              ],
            },
          ],
        });

        const parsed = response.parsed_output;
        if (!parsed) {
          throw new QuizGenerationError(
            "model returned shape that did not match QuizGenerationSchema",
            "anthropic",
          );
        }

        return {
          questions: parsed.questions,
          usage: {
            model: DEFAULT_MODEL,
            inputTokens: response.usage.input_tokens,
            outputTokens: response.usage.output_tokens,
            cachedTokens: response.usage.cache_read_input_tokens ?? 0,
          },
        };
      } catch (error) {
        if (error instanceof QuizGenerationError) throw error;
        const message =
          error instanceof Error ? error.message : "unknown_anthropic_error";
        throw new QuizGenerationError(message, "anthropic", error);
      }
    },

    async generateFlashcards({
      documentText,
      count,
    }: FlashcardGenerationInput): Promise<FlashcardGenerationResult> {
      const anthropic = getAnthropicClient();
      try {
        const response = await anthropic.messages.parse({
          model: DEFAULT_MODEL,
          max_tokens: 16000,
          thinking: { type: "adaptive" },
          output_config: {
            effort: "medium",
            format: zodOutputFormat(FlashcardGenerationSchema),
          },
          system: [
            {
              type: "text",
              text: FLASHCARD_SYSTEM_PROMPT,
              cache_control: { type: "ephemeral" },
            },
          ],
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: `<document>\n${documentText}\n</document>`,
                  cache_control: { type: "ephemeral" },
                },
                {
                  type: "text",
                  text: buildFlashcardPrompt({
                    documentText: "(see prior block)",
                    count,
                  }).replace(/<document>[\s\S]*?<\/document>\n\n/, ""),
                },
              ],
            },
          ],
        });

        const parsed = response.parsed_output;
        if (!parsed) {
          throw new QuizGenerationError(
            "model returned shape that did not match FlashcardGenerationSchema",
            "anthropic",
          );
        }

        return {
          flashcards: parsed.flashcards,
          usage: {
            model: DEFAULT_MODEL,
            inputTokens: response.usage.input_tokens,
            outputTokens: response.usage.output_tokens,
            cachedTokens: response.usage.cache_read_input_tokens ?? 0,
          },
        };
      } catch (error) {
        if (error instanceof QuizGenerationError) throw error;
        const message =
          error instanceof Error ? error.message : "unknown_anthropic_error";
        throw new QuizGenerationError(message, "anthropic", error);
      }
    },
  };
}
