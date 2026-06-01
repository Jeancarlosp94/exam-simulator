import { NextResponse } from "next/server";

import { getQuizGenerator, QuizGenerationError } from "@/lib/ai";
import { getUserPlan } from "@/lib/billing/plan";
import { GenerateQuizRequestSchema } from "@/lib/quiz/schemas";
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

  // Plan gate — questions-per-quiz cap. Free: 20, Pro: 30. The Zod schema
  // accepts up to 30; here we clamp to the user's plan to keep free users
  // from hitting the hard ceiling.
  const plan = await getUserPlan(user.id);
  if (count > plan.limits.questionsPerQuiz) {
    return NextResponse.json(
      {
        error: "plan_limit_exceeded",
        detail: `Tu plan ${plan.plan} permite hasta ${plan.limits.questionsPerQuiz} preguntas por quiz.`,
        limit: plan.limits.questionsPerQuiz,
        requested: count,
        plan: plan.plan,
      },
      { status: 402 },
    );
  }

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

  // 6. Generate via the picked AI provider (Gemini by default, Anthropic if
  //    AI_PROVIDER=anthropic). Each provider handles its own model,
  //    structured output, and prompt caching internally.
  const generator = getQuizGenerator();
  let generationResult;
  try {
    generationResult = await generator.generate({
      documentText,
      count,
      difficulty,
    });
  } catch (error) {
    const detail =
      error instanceof QuizGenerationError
        ? error.message
        : error instanceof Error
          ? error.message
          : "unknown_error";
    return NextResponse.json(
      { error: "ai_generation_failed", detail, provider: generator.name },
      { status: 502 },
    );
  }

  const generated = { questions: generationResult.questions };

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
      generation_model: generationResult.usage.model,
      generation_tokens_input: generationResult.usage.inputTokens,
      generation_tokens_output: generationResult.usage.outputTokens,
      generation_cached_tokens: generationResult.usage.cachedTokens,
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
    provider: generator.name,
    usage: {
      input_tokens: generationResult.usage.inputTokens,
      output_tokens: generationResult.usage.outputTokens,
      cached_tokens: generationResult.usage.cachedTokens,
    },
  });
}
