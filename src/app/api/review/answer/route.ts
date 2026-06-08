import { NextResponse } from "next/server";
import { z } from "zod";

import { applySm2, qualityFromCorrectness, type Quality } from "@/lib/srs/sm2";
import { recordActivity } from "@/lib/streak";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseServiceClient } from "@/lib/supabase/service";

/**
 * POST /api/review/answer
 * Body: either { card_id, is_correct } (quiz path — binary) or
 *       { card_id, quality } (flashcard path — Again/Hard/Good/Easy)
 *
 * Applies SM-2 to a single review card and writes the new schedule.
 * Both source types funnel through the same SM-2 update.
 */
export const runtime = "nodejs";
export const maxDuration = 15;

const BodySchema = z
  .object({
    card_id: z.string().uuid(),
    is_correct: z.boolean().optional(),
    quality: z.number().int().min(0).max(5).optional(),
  })
  .refine(
    (b) => b.is_correct !== undefined || b.quality !== undefined,
    "Either is_correct or quality must be supplied",
  );

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const parsed = BodySchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_body", issues: parsed.error.issues },
      { status: 400 },
    );
  }
  const { card_id, is_correct, quality } = parsed.data;

  const service = getSupabaseServiceClient();
  const { data: card, error: cardError } = await service
    .from("srs_cards")
    .select("id, user_id, ease_factor, interval_days, repetitions")
    .eq("id", card_id)
    .single();
  if (cardError || !card) {
    return NextResponse.json({ error: "card_not_found" }, { status: 404 });
  }
  if (card.user_id !== user.id) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  // Explicit quality wins (flashcard self-rate); else fall back to the
  // binary correct/incorrect mapping used by quiz attempts.
  const effectiveQuality: Quality =
    quality !== undefined
      ? (quality as Quality)
      : qualityFromCorrectness(is_correct ?? false);

  const next = applySm2(
    {
      ease_factor: card.ease_factor,
      interval_days: card.interval_days,
      repetitions: card.repetitions,
    },
    effectiveQuality,
  );

  const { error: updateError } = await service
    .from("srs_cards")
    .update({
      ease_factor: next.ease_factor,
      interval_days: next.interval_days,
      repetitions: next.repetitions,
      next_review_at: next.next_review_at,
      last_reviewed_at: next.last_reviewed_at,
    })
    .eq("id", card_id);

  if (updateError) {
    return NextResponse.json(
      { error: "update_failed", detail: updateError.message },
      { status: 500 },
    );
  }

  // Daily activity for streak — fire-and-forget.
  void recordActivity(user.id, "review");

  return NextResponse.json({
    next_review_at: next.next_review_at,
    interval_days: next.interval_days,
    repetitions: next.repetitions,
  });
}
