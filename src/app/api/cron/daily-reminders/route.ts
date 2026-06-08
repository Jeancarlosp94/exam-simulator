import { NextResponse } from "next/server";

import { envOrNull, isPlaceholder } from "@/lib/env";
import { getSupabaseServiceClient } from "@/lib/supabase/service";

/**
 * GET /api/cron/daily-reminders
 *
 * Vercel Cron entry. Configured in vercel.json to fire daily at 14:00
 * UTC (~09:00 Ecuador). For each user with email_reminder_enabled=true
 * and at least one due SRS card, sends a "tenés N tarjetas listas" email.
 *
 * Auth: requires `Authorization: Bearer <CRON_SECRET>`. Vercel Cron
 * sends the secret automatically when configured.
 *
 * Current state — stubbed: the route logs candidates but doesn't send
 * because Resend isn't wired (no verified domain). To activate:
 *
 *   1. Set RESEND_API_KEY in Vercel env (real key, not placeholder)
 *   2. Verify your sending domain in Resend
 *   3. Set RESEND_FROM_EMAIL to your sender (e.g. "Quizen <noreply@quizen.app>")
 *   4. Uncomment the resend.emails.send block below
 *   5. Redeploy
 *
 * Cap per run: 100 to stay under Resend free-tier daily quota. If you
 * grow past that, switch to batch mode or page through users.
 */
export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_PER_RUN = 100;

export async function GET(request: Request) {
  // Auth: Vercel Cron sends Bearer <CRON_SECRET> when configured.
  const cronSecret = envOrNull("CRON_SECRET");
  if (cronSecret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  const service = getSupabaseServiceClient();

  // Eligible users: opted-in + have at least one SRS card due now.
  const nowIso = new Date().toISOString();
  const { data: candidates, error: candidatesError } = await service
    .from("profiles")
    .select("id, email")
    .eq("email_reminder_enabled", true)
    .limit(MAX_PER_RUN * 2); // grab more than we'll send; we'll filter by due cards next

  if (candidatesError) {
    return NextResponse.json(
      { error: "candidates_query_failed", detail: candidatesError.message },
      { status: 500 },
    );
  }

  if (!candidates || candidates.length === 0) {
    return NextResponse.json({ sent: 0, skipped: 0, reason: "no_candidates" });
  }

  // Count due cards per user. Single query, group client-side.
  const userIds = candidates.map((c) => c.id);
  const { data: dueRows } = await service
    .from("srs_cards")
    .select("user_id")
    .in("user_id", userIds)
    .lte("next_review_at", nowIso);

  const dueCount = new Map<string, number>();
  for (const row of dueRows ?? []) {
    dueCount.set(row.user_id, (dueCount.get(row.user_id) ?? 0) + 1);
  }

  const toSend = candidates
    .filter((c) => (dueCount.get(c.id) ?? 0) > 0)
    .slice(0, MAX_PER_RUN);

  // ── Send (or stub) ───────────────────────────────────────────────────
  const resendKey = envOrNull("RESEND_API_KEY");
  const fromEmail = envOrNull("RESEND_FROM_EMAIL");
  const emailReady = resendKey && !isPlaceholder(resendKey) && fromEmail;

  if (!emailReady) {
    // Stub: log who we WOULD have emailed. Useful for verifying the
    // pipeline works before flipping the switch.
    for (const u of toSend) {
      console.info(
        `[cron/daily-reminders] (stub) would email ${u.email}: ${dueCount.get(u.id)} due cards`,
      );
    }
    return NextResponse.json({
      sent: 0,
      skipped: toSend.length,
      reason: "email_provider_not_configured",
    });
  }

  // ── Live send path (uncomment when Resend is wired) ──────────────────
  //
  // const { Resend } = await import("resend");
  // const resend = new Resend(resendKey);
  // let sent = 0;
  // for (const u of toSend) {
  //   const count = dueCount.get(u.id) ?? 0;
  //   try {
  //     await resend.emails.send({
  //       from: fromEmail,
  //       to: u.email,
  //       subject: `Quizen: ${count} ${count === 1 ? "tarjeta" : "tarjetas"} listas para repasar`,
  //       html: `<p>Buenos días.</p><p>Tenés <strong>${count}</strong> ${count === 1 ? "tarjeta" : "tarjetas"} en tu cola de repaso.</p><p><a href="https://quizen.app/review">Repasá ahora →</a></p>`,
  //     });
  //     sent++;
  //   } catch (err) {
  //     console.warn(`[cron/daily-reminders] send failed for ${u.email}:`, err);
  //   }
  // }
  // return NextResponse.json({ sent, skipped: toSend.length - sent });

  return NextResponse.json({
    sent: 0,
    skipped: toSend.length,
    reason: "live_send_disabled_by_default",
  });
}
