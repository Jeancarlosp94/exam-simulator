/**
 * Daily activity + streak tracking. Activity rows are server-only —
 * writes go through the service client. Reads from the streak function
 * are RLS-safe (the function is stable and scoped to a user id).
 */

import { getSupabaseServiceClient } from "@/lib/supabase/service";

type ActivityType = "review" | "quiz" | "study_chunk";

/**
 * Bump the matching counter on today's daily_activity row, creating it
 * if needed. Fire-and-forget — caller awaits but the SRS / quiz flow
 * should NOT block on this writing. Errors are logged, not thrown,
 * because losing a streak signal is far cheaper than failing the user's
 * primary action.
 */
export async function recordActivity(
  userId: string,
  type: ActivityType,
): Promise<void> {
  const service = getSupabaseServiceClient();
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD UTC

  const column =
    type === "review"
      ? "reviews_completed"
      : type === "quiz"
        ? "quizzes_completed"
        : "study_chunks_done";

  // Upsert with on-conflict counter bump. Postgres' insert..on conflict
  // do update with `excluded` lets us increment without a read-modify-write
  // race between concurrent quiz completions.
  try {
    const { error } = await service.rpc("increment_daily_activity", {
      p_user_id: userId,
      p_activity_date: today,
      p_column: column,
    });
    if (error) {
      // RPC not available yet? Fall back to upsert with read-modify-write.
      // Mostly defensive — the RPC is created in migration 0008.
      await fallbackUpsert(userId, today, column);
    }
  } catch (err) {
    console.warn(
      "[streak] recordActivity failed (non-fatal):",
      err instanceof Error ? err.message : err,
    );
  }
}

async function fallbackUpsert(
  userId: string,
  today: string,
  column: string,
): Promise<void> {
  const service = getSupabaseServiceClient();
  const { data: existing } = await service
    .from("daily_activity")
    .select("reviews_completed, quizzes_completed, study_chunks_done")
    .eq("user_id", userId)
    .eq("activity_date", today)
    .maybeSingle();

  if (existing) {
    const next = {
      reviews_completed: existing.reviews_completed,
      quizzes_completed: existing.quizzes_completed,
      study_chunks_done: existing.study_chunks_done,
    };
    if (column === "reviews_completed") next.reviews_completed += 1;
    else if (column === "quizzes_completed") next.quizzes_completed += 1;
    else next.study_chunks_done += 1;

    await service
      .from("daily_activity")
      .update(next)
      .eq("user_id", userId)
      .eq("activity_date", today);
  } else {
    await service.from("daily_activity").insert({
      user_id: userId,
      activity_date: today,
      reviews_completed: column === "reviews_completed" ? 1 : 0,
      quizzes_completed: column === "quizzes_completed" ? 1 : 0,
      study_chunks_done: column === "study_chunks_done" ? 1 : 0,
    });
  }
}

/**
 * Returns the current consecutive-day streak for a user. Calls the
 * stable Postgres function get_user_streak. Returns 0 on any error so
 * the UI never crashes on the streak badge.
 */
export async function getStreak(userId: string): Promise<number> {
  const service = getSupabaseServiceClient();
  try {
    const { data, error } = await service.rpc("get_user_streak", {
      p_user_id: userId,
    });
    if (error) return 0;
    if (typeof data === "number") return data;
    return Number(data) || 0;
  } catch {
    return 0;
  }
}
