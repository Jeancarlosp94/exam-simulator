import { NextResponse } from "next/server";
import { z } from "zod";

import { getQuizGenerator, QuizGenerationError } from "@/lib/ai";
import { checkRateLimit } from "@/lib/rate-limit";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseServiceClient } from "@/lib/supabase/service";

/**
 * POST /api/quiz/regenerate-question
 * Body: { question_id: string }
 *
 * Generates a single replacement question grounded in the same source
 * chunk as the original, then overwrites prompt/options/correct_label/
 * explanation/bloom_level/difficulty in place. Position is unchanged so
 * results pages don't reshuffle.
 *
 * We reuse the multi-question generator with count=1; the structured
 * output guarantees we still get a schema-valid question.
 */
export const runtime = "nodejs";
export const maxDuration = 60;

const Body = z.object({ question_id: z.string().uuid() });

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const rateLimit = await checkRateLimit(
    { prefix: "question-regen", requests: 15, window: "1 h" },
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

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const parsed = Body.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_body", issues: parsed.error.issues },
      { status: 400 },
    );
  }
  const { question_id } = parsed.data;

  const service = getSupabaseServiceClient();

  // 1. Question core — to get the quiz + source chunk ids.
  const { data: question, error: questionError } = await service
    .from("questions")
    .select("id, quiz_id, source_chunk_id")
    .eq("id", question_id)
    .single();
  if (questionError || !question) {
    return NextResponse.json({ error: "question_not_found" }, { status: 404 });
  }

  // 2. Ownership + difficulty target.
  const { data: quiz } = await service
    .from("quizzes")
    .select("user_id, difficulty")
    .eq("id", question.quiz_id)
    .single();
  if (!quiz || quiz.user_id !== user.id) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  // 3. Source chunk for grounding. If null, we have no way to regenerate
  //    faithfully — refuse rather than invent.
  if (!question.source_chunk_id) {
    return NextResponse.json(
      {
        error: "no_source_chunk",
        detail:
          "Esta pregunta no está anclada a un chunk del documento; no podemos regenerar.",
      },
      { status: 422 },
    );
  }
  const { data: sourceChunk } = await service
    .from("document_chunks")
    .select("content, chunk_index")
    .eq("id", question.source_chunk_id)
    .single();
  if (!sourceChunk) {
    return NextResponse.json(
      { error: "source_chunk_missing" },
      { status: 422 },
    );
  }

  // Generate ONE question from the source chunk. Reuses the document
  // wrapping + system prompt + structured output of the full generator.
  const generator = getQuizGenerator();
  let generated;
  try {
    generated = await generator.generate({
      documentText: `[CHUNK ${sourceChunk.chunk_index}]\n${sourceChunk.content}`,
      count: 1,
      difficulty: quiz.difficulty,
    });
  } catch (err) {
    const detail =
      err instanceof QuizGenerationError
        ? err.message
        : err instanceof Error
          ? err.message
          : "unknown_error";
    return NextResponse.json(
      { error: "ai_generation_failed", detail, provider: generator.name },
      { status: 502 },
    );
  }

  const replacement = generated.questions[0];
  if (!replacement) {
    return NextResponse.json(
      { error: "no_question_generated" },
      { status: 502 },
    );
  }

  // Overwrite in place. We keep id/quiz_id/position/source_chunk_id
  // identical so results pages and SRS cards don't break.
  const { error: updateError } = await service
    .from("questions")
    .update({
      prompt: replacement.prompt,
      options: replacement.options,
      correct_label: replacement.correct_label,
      explanation: replacement.explanation,
      bloom_level: replacement.bloom_level,
      difficulty: replacement.difficulty,
    })
    .eq("id", question_id);

  if (updateError) {
    return NextResponse.json(
      { error: "update_failed", detail: updateError.message },
      { status: 500 },
    );
  }

  return NextResponse.json({
    question_id,
    prompt: replacement.prompt,
    options: replacement.options,
    correct_label: replacement.correct_label,
    explanation: replacement.explanation,
    bloom_level: replacement.bloom_level,
    difficulty: replacement.difficulty,
    provider: generator.name,
  });
}
