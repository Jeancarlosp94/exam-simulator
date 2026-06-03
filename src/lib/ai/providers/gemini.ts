import { GoogleGenAI, Type } from "@google/genai";

import { optionalEnv, requireEnv } from "@/lib/env";
import { buildUserPrompt, SYSTEM_PROMPT } from "@/lib/quiz/prompts";
import {
  QuizGenerationSchema,
  BLOOM_LEVELS,
  DIFFICULTIES,
  OPTION_LABELS,
} from "@/lib/quiz/schemas";

import {
  QuizGenerationError,
  type QuizGenerationInput,
  type QuizGenerationResult,
  type QuizGenerator,
} from "../types";

/**
 * Google Gemini provider. Defaults to gemini-2.5-flash which is on the
 * free tier (1M tokens/day input, 15 RPM). Excellent for quiz generation
 * — supports native structured output via responseSchema, large context,
 * and fast (10-20s for a typical document).
 *
 * Cost reference: $0 on free tier within quotas. Paid tier:
 * $0.075/$0.30 per 1M input/output (40x cheaper than Claude Opus 4.7).
 *
 * Get a key: https://aistudio.google.com/app/apikey
 */

const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash";

/**
 * JSON schema for Gemini's responseSchema. Hand-written to mirror
 * QuizGenerationSchema (Zod) — duplication is intentional because
 * Gemini's Schema type is a subset of JSON Schema and the converters
 * from zod often introduce incompatible fields. If we change the Zod
 * schema, update this in the same commit.
 */
function buildResponseSchema() {
  return {
    type: Type.OBJECT,
    properties: {
      questions: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            prompt: {
              type: Type.STRING,
              description: "The question itself, in the document's language.",
            },
            options: {
              type: Type.ARRAY,
              description:
                "Exactly 4 options labeled A, B, C, D. Distractors must be plausible.",
              items: {
                type: Type.OBJECT,
                properties: {
                  label: {
                    type: Type.STRING,
                    enum: [...OPTION_LABELS],
                  },
                  text: { type: Type.STRING },
                },
                required: ["label", "text"],
              },
            },
            correct_label: {
              type: Type.STRING,
              enum: [...OPTION_LABELS],
              description: "Label of the single correct option.",
            },
            explanation: {
              type: Type.STRING,
              description:
                "Why correct is right AND why most tempting wrong is wrong.",
            },
            bloom_level: {
              type: Type.STRING,
              enum: [...BLOOM_LEVELS],
            },
            difficulty: {
              type: Type.STRING,
              enum: [...DIFFICULTIES],
            },
            source_chunk_index: {
              type: Type.INTEGER,
              description:
                "Zero-based index of the [CHUNK N] this question is grounded in.",
            },
          },
          required: [
            "prompt",
            "options",
            "correct_label",
            "explanation",
            "bloom_level",
            "difficulty",
            "source_chunk_index",
          ],
        },
      },
    },
    required: ["questions"],
  };
}

/**
 * Retry transient Gemini failures (overload / rate / 5xx) with exponential
 * backoff. The free tier explicitly returns 503 UNAVAILABLE during spikes
 * and the docs say "wait a moment and try again" — exactly what this loop
 * does. Hard model errors (bad request, schema invalid) are NOT retried.
 */
const TRANSIENT_STATUS_CODES = new Set([429, 500, 502, 503, 504]);
const MAX_RETRIES = 3;
const BASE_BACKOFF_MS = 1500;

function isTransientGeminiError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const msg = err.message ?? "";
  // The SDK throws an Error whose message contains the JSON error envelope.
  for (const code of TRANSIENT_STATUS_CODES) {
    if (msg.includes(`"code":${code}`)) return true;
  }
  if (/UNAVAILABLE|RESOURCE_EXHAUSTED|DEADLINE_EXCEEDED/i.test(msg))
    return true;
  return false;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function createGeminiQuizGenerator(): QuizGenerator {
  const apiKey = requireEnv("GEMINI_API_KEY");
  const model = optionalEnv("GEMINI_MODEL", DEFAULT_GEMINI_MODEL);
  const client = new GoogleGenAI({ apiKey });

  return {
    name: `gemini:${model}`,

    async generate({
      documentText,
      count,
      difficulty,
    }: QuizGenerationInput): Promise<QuizGenerationResult> {
      // Gemini doesn't have a `system` parameter the way Claude does —
      // prepend the system prompt to the user content. The prompt
      // template already wraps the document in <document> tags so
      // anti-injection still holds.
      const userPrompt = buildUserPrompt({
        documentText,
        count,
        difficulty,
      });

      let lastError: unknown;
      for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        try {
          const response = await client.models.generateContent({
            model,
            contents: [
              { role: "user", parts: [{ text: SYSTEM_PROMPT }] },
              { role: "user", parts: [{ text: userPrompt }] },
            ],
            config: {
              responseMimeType: "application/json",
              responseSchema: buildResponseSchema(),
              // Lower temperature for more consistent JSON shape. Gemini
              // ignores temperature for structured output but doesn't error.
              temperature: 0.7,
            },
          });

          const text = response.text;
          if (!text) {
            throw new QuizGenerationError(
              "model returned empty response",
              "gemini",
            );
          }

          const parsed = QuizGenerationSchema.safeParse(JSON.parse(text));
          if (!parsed.success) {
            throw new QuizGenerationError(
              `output failed Zod validation: ${parsed.error.message}`,
              "gemini",
            );
          }

          const usage = response.usageMetadata;
          return {
            questions: parsed.data.questions,
            usage: {
              model,
              inputTokens: usage?.promptTokenCount ?? 0,
              outputTokens: usage?.candidatesTokenCount ?? 0,
              cachedTokens: usage?.cachedContentTokenCount ?? 0,
            },
          };
        } catch (error) {
          lastError = error;
          if (error instanceof QuizGenerationError) throw error;
          if (!isTransientGeminiError(error) || attempt === MAX_RETRIES) {
            const message =
              error instanceof Error ? error.message : "unknown_gemini_error";
            throw new QuizGenerationError(message, "gemini", error);
          }
          // 1.5s, 3s, 6s — total worst-case wait 10.5s before final attempt.
          const backoff = BASE_BACKOFF_MS * 2 ** attempt;
          console.warn(
            `[gemini] transient error on attempt ${attempt + 1}/${MAX_RETRIES + 1}, retrying in ${backoff}ms`,
          );
          await sleep(backoff);
        }
      }

      // Unreachable — the loop throws on its last iteration — but TS can't see it.
      const message =
        lastError instanceof Error ? lastError.message : "unknown_gemini_error";
      throw new QuizGenerationError(message, "gemini", lastError);
    },
  };
}
