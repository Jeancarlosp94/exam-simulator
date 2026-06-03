import { NextResponse } from "next/server";

import { getQuizGenerator, QuizGenerationError } from "@/lib/ai";
import { GenerateFlashcardsRequestSchema } from "@/lib/quiz/schemas";
import { checkRateLimit } from "@/lib/rate-limit";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseServiceClient } from "@/lib/supabase/service";

/**
 * POST /api/flashcards/generate
 * Body: { document_id, count }
 *
 * Generates `count` flashcards from a ready document and persists them.
 * Mirrors quiz/generate but produces front/back pairs instead of MCQs.
 * Each card gets paired SRS state at creation time so they immediately
 * enter the /review queue (next_review_at = now).
 */
export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const rateLimit = await checkRateLimit(
    { prefix: "flashcards-generate", requests: 5, window: "1 h" },
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

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const parsed = GenerateFlashcardsRequestSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_body", issues: parsed.error.issues },
      { status: 400 },
    );
  }
  const { document_id, count } = parsed.data;

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

  // Load chunks (same pattern as quiz/generate) so the source_chunk_index
  // returned by the model maps back to a real chunk_id.
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

  const generator = getQuizGenerator();
  let generationResult;
  try {
    generationResult = await generator.generateFlashcards({
      documentText,
      count,
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

  const chunkById = new Map<number, string>();
  for (const c of chunks) chunkById.set(c.chunk_index, c.id);

  // Insert flashcards, then in a follow-up insert create one SRS card per
  // flashcard so they're already in the /review queue.
  const flashcardRows = generationResult.flashcards.map((card) => ({
    user_id: user.id,
    document_id,
    front: card.front,
    back: card.back,
    bloom_level: card.bloom_level,
    source_chunk_id: chunkById.get(card.source_chunk_index) ?? null,
  }));

  const { data: insertedFlashcards, error: insertError } = await service
    .from("flashcards")
    .insert(flashcardRows)
    .select("id");

  if (insertError || !insertedFlashcards) {
    return NextResponse.json(
      {
        error: "flashcards_insert_failed",
        detail: insertError?.message,
      },
      { status: 500 },
    );
  }

  // SRS cards — one per flashcard, due immediately. Failure here doesn't
  // roll back the flashcards: the user can still view them at /study and
  // we can backfill later if needed.
  const srsRows = insertedFlashcards.map((f) => ({
    user_id: user.id,
    source_type: "flashcard" as const,
    flashcard_id: f.id,
    question_id: null,
  }));
  const { error: srsError } = await service.from("srs_cards").insert(srsRows);
  if (srsError) {
    console.warn("[flashcards-generate] srs seed failed:", srsError.message);
  }

  return NextResponse.json({
    document_id,
    flashcards_count: insertedFlashcards.length,
    provider: generator.name,
    usage: {
      input_tokens: generationResult.usage.inputTokens,
      output_tokens: generationResult.usage.outputTokens,
      cached_tokens: generationResult.usage.cachedTokens,
    },
  });
}
