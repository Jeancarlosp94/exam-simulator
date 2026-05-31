import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { NextResponse } from "next/server";

import { DEFAULT_MODEL, getAnthropicClient } from "@/lib/anthropic";
import { buildUserPrompt, SYSTEM_PROMPT } from "@/lib/quiz/prompts";
import {
  GenerateQuizRequestSchema,
  QuizGenerationSchema,
} from "@/lib/quiz/schemas";
import { checkRateLimit } from "@/lib/rate-limit";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseServiceClient } from "@/lib/supabase/service";

/**
 * POST /api/quiz/generate
 * Body: { document_id, count, difficulty, title? }
 *
 * Generates `count` quiz questions from a previously-extracted document and
 * persists a quizzes row + questions rows. Uses claude-opus-4-7 with
 * adaptive thinking + structured outputs (zodOutputFormat) so the model
 * returns JSON guaranteed to match QuizGenerationSchema — no fragile prompt
 * tricks, no markdown-code-fence parsing.
 *
 * Prompt-caching strategy:
 *   1. SYSTEM_PROMPT is cached (stable across requests)
 *   2. The document chunks are cached (stable per document)
 *   3. The per-request instruction (count, difficulty) is uncached
 * Result: 2nd+ generations on the same document are ~90% cheaper on input
 * tokens for the document portion.
 *
 * Returns: { quiz_id, questions_count, usage }.
 */
export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(request: Request) {
  // 1. Auth
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // 2. Rate limit — Anthropic Opus 4.7 is $5/$25 per 1M tokens; a 50K-token
  //    document at high effort can cost several USD. 5/hour caps damage.
  const rateLimit = await checkRateLimit(
    { prefix: "quiz-generate", requests: 5, window: "1 h" },
    user.id,
  );
  if (!rateLimit.ok) {
    return NextResponse.json(
      {
        error: "rate_limited",
        retry_after_seconds: rateLimit.retryAfterSeconds,
      },
      {
        status: 429,
        headers: { "Retry-After": String(rateLimit.retryAfterSeconds) },
      },
    );
  }

  // 3. Parse + validate body
  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const parsed = GenerateQuizRequestSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_body", issues: parsed.error.issues },
      { status: 400 },
    );
  }
  const { document_id, count, difficulty, title } = parsed.data;

  // 4. Verify ownership + status='ready' (service client bypasses RLS so we
  //    can read .user_id directly to enforce; manual check, not RLS).
  const service = getSupabaseServiceClient();
  const { data: document, error: docError } = await service
    .from("documents")
    .select("id, user_id, title, status")
    .eq("id", document_id)
    .single();
  if (docError || !document) {
    return NextResponse.json({ error: "document_not_found" }, { status: 404 });
  }
  if (document.user_id !== user.id) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  if (document.status !== "ready") {
    return NextResponse.json(
      { error: "document_not_ready", status: document.status },
      { status: 409 },
    );
  }

  // 5. Load chunks ordered by chunk_index so [CHUNK N] markers line up with
  //    what the model sees and the source_chunk_index it returns.
  const { data: chunks, error: chunkError } = await service
    .from("document_chunks")
    .select("id, chunk_index, content")
    .eq("document_id", document_id)
    .order("chunk_index", { ascending: true });
  if (chunkError || !chunks || chunks.length === 0) {
    return NextResponse.json(
      { error: "no_chunks", detail: chunkError?.message },
      { status: 500 },
    );
  }

  const documentText = chunks
    .map((c) => `[CHUNK ${c.chunk_index}]\n${c.content}`)
    .join("\n\n");

  // 6. Call Claude. Three breakpoints — system, document, then the per-request
  //    instruction is intentionally uncached.
  const anthropic = getAnthropicClient();
  let parseResponse;
  try {
    parseResponse = await anthropic.messages.parse({
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
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "anthropic_request_failed";
    return NextResponse.json(
      { error: "anthropic_request_failed", detail: message },
      { status: 502 },
    );
  }

  const generated = parseResponse.parsed_output;
  if (!generated) {
    return NextResponse.json(
      { error: "parse_failed", detail: "model_returned_invalid_shape" },
      { status: 502 },
    );
  }

  // 7. Map source_chunk_index -> source_chunk_id (fall back to null if the
  //    model invented a chunk index — better to lose grounding than crash).
  const chunkById = new Map<number, string>();
  for (const c of chunks) chunkById.set(c.chunk_index, c.id);

  // 8. Insert quiz + questions atomically (logically — Postgres single
  //    transaction would be nicer, but supabase-js bulk inserts are
  //    individually atomic and we roll back via delete on failure below).
  const quizTitle =
    title?.trim() || `Quiz de ${document.title} (${count} preguntas)`;

  const { data: insertedQuiz, error: quizError } = await service
    .from("quizzes")
    .insert({
      user_id: user.id,
      document_id,
      title: quizTitle,
      difficulty,
      question_count: generated.questions.length,
      generation_model: DEFAULT_MODEL,
      generation_tokens_input: parseResponse.usage.input_tokens,
      generation_tokens_output: parseResponse.usage.output_tokens,
      generation_cached_tokens:
        parseResponse.usage.cache_read_input_tokens ?? 0,
    })
    .select("id")
    .single();
  if (quizError || !insertedQuiz) {
    return NextResponse.json(
      { error: "quiz_insert_failed", detail: quizError?.message },
      { status: 500 },
    );
  }

  const { error: questionsError } = await service.from("questions").insert(
    generated.questions.map((q, position) => ({
      quiz_id: insertedQuiz.id,
      position,
      prompt: q.prompt,
      options: q.options,
      correct_label: q.correct_label,
      explanation: q.explanation,
      bloom_level: q.bloom_level,
      difficulty: q.difficulty,
      source_chunk_id: chunkById.get(q.source_chunk_index) ?? null,
    })),
  );
  if (questionsError) {
    // Roll back the quiz row so /library doesn't show an empty quiz.
    await service.from("quizzes").delete().eq("id", insertedQuiz.id);
    return NextResponse.json(
      {
        error: "questions_insert_failed",
        detail: questionsError.message,
      },
      { status: 500 },
    );
  }

  return NextResponse.json({
    quiz_id: insertedQuiz.id,
    questions_count: generated.questions.length,
    usage: {
      input_tokens: parseResponse.usage.input_tokens,
      output_tokens: parseResponse.usage.output_tokens,
      cache_read_input_tokens: parseResponse.usage.cache_read_input_tokens ?? 0,
      cache_creation_input_tokens:
        parseResponse.usage.cache_creation_input_tokens ?? 0,
    },
  });
}
