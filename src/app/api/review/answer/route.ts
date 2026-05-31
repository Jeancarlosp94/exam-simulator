import { NextResponse } from "next/server";
import { z } from "zod";

import { applySm2, qualityFromCorrectness } from "@/lib/srs/sm2";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseServiceClient } from "@/lib/supabase/service";

/**
 * POST /api/review/answer
 * Body: { card_id, is_correct }
 *
 * Applies SM-2 to a single review card and writes the new schedule.
 * Sprint 6 uses a binary correctness signal; Sprint 7+ could expose
 * the full quality scale (Again / Hard / Good / Easy) for finer-grained
 * intervals — for now correct=5 / incorrect=1 mirrors what the grade
 * route does.
 */
export const runtime = "nodejs";
export const maxDuration = 15;

const BodySchema = z.object({
  card_id: z.string().uuid(),
  is_correct: z.boolean(),
});

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
  const { card_id, is_correct } = parsed.data;

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

  const next = applySm2(
    {
      ease_factor: card.ease_factor,
      interval_days: card.interval_days,
      repetitions: card.repetitions,
    },
    qualityFromCorrectness(is_correct),
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

  return NextResponse.json({
    next_review_at: next.next_review_at,
    interval_days: next.interval_days,
    repetitions: next.repetitions,
  });
}
