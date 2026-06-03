import { NextResponse } from "next/server";
import { z } from "zod";

import { applySm2, qualityFromCorrectness } from "@/lib/srs/sm2";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseServiceClient } from "@/lib/supabase/service";

/**
 * POST /api/quiz/grade
 * Body: { attempt_id: string }
 *
 * Closes an in-progress attempt:
 *   1. Verifies ownership.
 *   2. Loads questions (correct_label) + answers for this attempt.
 *   3. Computes is_correct per answer and bulk-updates the answers rows.
 *   4. Computes score_correct / score_total / time_spent_seconds and
 *      writes them to attempts along with completed_at = now().
 *
 * Idempotent: re-grading a completed attempt is a no-op return of its
 * existing scores (so a double-click on Entregar doesn't double-write).
 */
export const runtime = "nodejs";
export const maxDuration = 30;

const BodySchema = z.object({
  attempt_id: z.string().uuid(),
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
  const { attempt_id } = parsed.data;

  const service = getSupabaseServiceClient();
  const { data: attempt, error: attemptError } = await service
    .from("attempts")
    .select(
      "id, user_id, quiz_id, started_at, completed_at, score_correct, score_total, time_spent_seconds",
    )
    .eq("id", attempt_id)
    .single();
  if (attemptError || !attempt) {
    return NextResponse.json({ error: "attempt_not_found" }, { status: 404 });
  }
  if (attempt.user_id !== user.id) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  // Idempotency: if already completed, return existing scores
  if (attempt.completed_at != null) {
    return NextResponse.json({
      already_graded: true,
      score_correct: attempt.score_correct,
      score_total: attempt.score_total,
      time_spent_seconds: attempt.time_spent_seconds,
    });
  }

  const { data: questions, error: questionsError } = await service
    .from("questions")
    .select("id, correct_label")
    .eq("quiz_id", attempt.quiz_id);
  if (questionsError || !questions || questions.length === 0) {
    return NextResponse.json(
      { error: "no_questions", detail: questionsError?.message },
      { status: 500 },
    );
  }

  const { data: answers, error: answersError } = await service
    .from("answers")
    .select("id, question_id, selected_label")
    .eq("attempt_id", attempt_id);
  if (answersError) {
    return NextResponse.json(
      { error: "answers_load_failed", detail: answersError.message },
      { status: 500 },
    );
  }

  const correctByQuestionId = new Map<string, string>();
  for (const q of questions) correctByQuestionId.set(q.id, q.correct_label);

  let scoreCorrect = 0;
  const gradedAnswers: Array<{ question_id: string; isCorrect: boolean }> = [];

  // Walk answers, compute is_correct, update the row. We do these in
  // parallel because they're independent and the worst-case set is ~30 rows.
  await Promise.all(
    (answers ?? []).map(async (a) => {
      const correctLabel = correctByQuestionId.get(a.question_id);
      const isCorrect =
        a.selected_label != null && a.selected_label === correctLabel;
      if (isCorrect) scoreCorrect += 1;
      if (a.selected_label != null) {
        gradedAnswers.push({ question_id: a.question_id, isCorrect });
      }
      await service
        .from("answers")
        .update({ is_correct: isCorrect })
        .eq("id", a.id);
    }),
  );

  // Upsert SRS cards for every ANSWERED question. We skip unanswered
  // ones — a skipped question isn't a recall failure, the user just
  // didn't get to it. Pre-load existing cards so SM-2 can pick up where
  // it left off across retakes of the same quiz.
  if (gradedAnswers.length > 0) {
    const questionIds = gradedAnswers.map((g) => g.question_id);
    const { data: existingCards } = await service
      .from("srs_cards")
      .select("question_id, ease_factor, interval_days, repetitions")
      .eq("user_id", user.id)
      .in("question_id", questionIds);

    const existingByQ = new Map<
      string,
      { ease_factor: number; interval_days: number; repetitions: number }
    >();
    for (const c of existingCards ?? []) {
      // question_id is nullable since Sprint 12 (flashcard cards leave it
      // null), but rows we filtered for in() are question-type by definition.
      if (!c.question_id) continue;
      existingByQ.set(c.question_id, {
        ease_factor: c.ease_factor,
        interval_days: c.interval_days,
        repetitions: c.repetitions,
      });
    }

    const now = new Date();
    const cardRows = gradedAnswers.map(({ question_id, isCorrect }) => {
      const next = applySm2(
        existingByQ.get(question_id) ?? null,
        qualityFromCorrectness(isCorrect),
        now,
      );
      return {
        user_id: user.id,
        question_id,
        ease_factor: next.ease_factor,
        interval_days: next.interval_days,
        repetitions: next.repetitions,
        next_review_at: next.next_review_at,
        last_reviewed_at: next.last_reviewed_at,
      };
    });

    const { error: srsError } = await service
      .from("srs_cards")
      .upsert(cardRows, { onConflict: "user_id,question_id" });
    if (srsError) {
      // Don't fail the whole grade if SRS write fails — log and continue.
      // Worst case: user just doesn't see this attempt in their review queue.
      console.warn("srs_upsert_failed", srsError.message);
    }
  }

  const completedAt = new Date();
  const timeSpentSeconds = Math.max(
    0,
    Math.floor(
      (completedAt.getTime() - new Date(attempt.started_at).getTime()) / 1000,
    ),
  );

  const { error: updateError } = await service
    .from("attempts")
    .update({
      completed_at: completedAt.toISOString(),
      time_spent_seconds: timeSpentSeconds,
      score_correct: scoreCorrect,
      score_total: questions.length,
    })
    .eq("id", attempt_id);

  if (updateError) {
    return NextResponse.json(
      { error: "attempt_update_failed", detail: updateError.message },
      { status: 500 },
    );
  }

  return NextResponse.json({
    already_graded: false,
    score_correct: scoreCorrect,
    score_total: questions.length,
    time_spent_seconds: timeSpentSeconds,
  });
}
