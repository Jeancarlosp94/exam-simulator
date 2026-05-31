import { z } from "zod";

import type { BloomLevel, Difficulty } from "@/lib/supabase/types";

/**
 * Schemas shared between the API route (validates Claude's output) and the
 * client (types form inputs and parses route responses).
 *
 * The JSON Schema that `zodOutputFormat` derives is what Claude sees. The
 * Anthropic SDK strips constraints that the structured-outputs feature
 * doesn't support (length, min/max, enum cardinality > N) and Zod validates
 * those client-side after the model responds. Plain enums, required fields,
 * and `additionalProperties: false` (added by SDK automatically) are honored
 * server-side.
 */

export const BLOOM_LEVELS = [
  "remember",
  "understand",
  "apply",
  "analyze",
  "evaluate",
  "create",
] as const satisfies readonly BloomLevel[];

export const DIFFICULTIES = [
  "easy",
  "medium",
  "hard",
] as const satisfies readonly Difficulty[];

export const OPTION_LABELS = ["A", "B", "C", "D"] as const;

export const QuestionOptionSchema = z.object({
  label: z.enum(OPTION_LABELS),
  text: z.string().min(1).describe("Option text shown to the student."),
});

export const QuestionSchema = z.object({
  prompt: z
    .string()
    .min(1)
    .describe("The question itself, written in the document's language."),
  options: z
    .array(QuestionOptionSchema)
    .length(4)
    .describe(
      "Exactly four options labeled A, B, C, D. Distractors must be plausible.",
    ),
  correct_label: z
    .enum(OPTION_LABELS)
    .describe("Label of the single correct option."),
  explanation: z
    .string()
    .min(1)
    .describe(
      "Why the correct answer is right AND why the most tempting wrong option is wrong, citing facts from the document.",
    ),
  bloom_level: z
    .enum(BLOOM_LEVELS)
    .describe(
      "Bloom's taxonomy level this question tests: remember, understand, apply, analyze, evaluate, create.",
    ),
  difficulty: z
    .enum(DIFFICULTIES)
    .describe("Actual difficulty of THIS question (easy/medium/hard)."),
  source_chunk_index: z
    .number()
    .int()
    .nonnegative()
    .describe(
      "Zero-based index of the document chunk this question is grounded in. Use the [CHUNK N] markers in the document.",
    ),
});

export const QuizGenerationSchema = z.object({
  questions: z.array(QuestionSchema).min(1),
});

export type GeneratedQuestion = z.infer<typeof QuestionSchema>;
export type QuizGeneration = z.infer<typeof QuizGenerationSchema>;

/**
 * Request body for POST /api/quiz/generate.
 */
export const GenerateQuizRequestSchema = z.object({
  document_id: z.string().uuid(),
  count: z.number().int().min(5).max(30),
  difficulty: z.enum(["easy", "mixed", "hard"]),
  title: z.string().min(1).max(200).optional(),
});

export type GenerateQuizRequest = z.infer<typeof GenerateQuizRequestSchema>;
