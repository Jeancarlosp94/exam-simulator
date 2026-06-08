import { NextResponse } from "next/server";

import { envOrNull } from "@/lib/env";
import { logSecurityEvent } from "@/lib/guard";
import { getSupabaseServiceClient } from "@/lib/supabase/service";

/**
 * GET /api/cron/daily-reminders
 *
 * Vercel Cron entry. Configured in vercel.json to fire daily at 14:00
 * UTC (~09:00 Ecuador). Sends a Web Push notification to every device
 * subscription belonging to a user with at least one due SRS card.
 *
 * Auth: requires `Authorization: Bearer <CRON_SECRET>` when CRON_SECRET
 * is set (Vercel Cron sends it automatically).
 *
 * No email path here — Sprint 13b replaced email with Web Push so we
 * don't need a verified domain or third-party provider. VAPID keys are
 * generated once via `npx web-push generate-vapid-keys` and stored as
 * NEXT_PUBLIC_VAPID_PUBLIC_KEY + VAPID_PRIVATE_KEY env vars.
 *
 * Cap per run: 500 subscription sends. Beyond that we'd want to page.
 */
export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_SENDS_PER_RUN = 500;

export async function GET(request: Request) {
  // Auth: Vercel Cron sends Bearer <CRON_SECRET> when configured.
  const cronSecret = envOrNull("CRON_SECRET");
  if (cronSecret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${cronSecret}`) {
      logSecurityEvent({
        kind: "auth_failed",
        route: "/api/cron/daily-reminders",
      });
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  } else {
    // Unconfigured CRON_SECRET in production is a misconfiguration —
    // anyone can hit this route. Log so the operator notices in Vercel logs.
    console.warn(
      "[cron/daily-reminders] CRON_SECRET is not set — route is publicly callable. Set the env var in Vercel.",
    );
  }

  const vapidPublic = envOrNull("NEXT_PUBLIC_VAPID_PUBLIC_KEY");
  const vapidPrivate = envOrNull("VAPID_PRIVATE_KEY");
  const vapidContact =
    envOrNull("VAPID_CONTACT_EMAIL") ?? "mailto:noreply@quizen.app";

  if (!vapidPublic || !vapidPrivate) {
    return NextResponse.json(
      {
        sent: 0,
        skipped: 0,
        reason: "vapid_not_configured",
        detail:
          "Set NEXT_PUBLIC_VAPID_PUBLIC_KEY + VAPID_PRIVATE_KEY. Generate with `npx web-push generate-vapid-keys`.",
      },
      { status: 200 },
    );
  }

  const service = getSupabaseServiceClient();
  const nowIso = new Date().toISOString();

  // 1. Users who have at least one due SRS card.
  const { data: dueRows, error: dueError } = await service
    .from("srs_cards")
    .select("user_id")
    .lte("next_review_at", nowIso);
  if (dueError) {
    return NextResponse.json(
      { error: "due_query_failed", detail: dueError.message },
      { status: 500 },
    );
  }

  const dueCount = new Map<string, number>();
  for (const row of dueRows ?? []) {
    dueCount.set(row.user_id, (dueCount.get(row.user_id) ?? 0) + 1);
  }
  const userIds = Array.from(dueCount.keys());
  if (userIds.length === 0) {
    return NextResponse.json({ sent: 0, skipped: 0, reason: "no_due_users" });
  }

  // 2. Fetch push subscriptions for those users.
  const { data: subs, error: subsError } = await service
    .from("push_subscriptions")
    .select("id, user_id, endpoint, p256dh, auth")
    .in("user_id", userIds)
    .limit(MAX_SENDS_PER_RUN);
  if (subsError) {
    return NextResponse.json(
      { error: "subs_query_failed", detail: subsError.message },
      { status: 500 },
    );
  }
  if (!subs || subs.length === 0) {
    return NextResponse.json({
      sent: 0,
      skipped: 0,
      reason: "no_subscriptions",
    });
  }

  // 3. Send. Dynamic import keeps web-push out of the cold-start surface
  //    for routes that don't need it.
  const webpush = (await import("web-push")).default;
  webpush.setVapidDetails(vapidContact, vapidPublic, vapidPrivate);

  let sent = 0;
  const deadSubs: string[] = [];

  await Promise.all(
    subs.map(async (s) => {
      const count = dueCount.get(s.user_id) ?? 0;
      const payload = JSON.stringify({
        title: "Quizen",
        body: `Tenés ${count} ${count === 1 ? "tarjeta" : "tarjetas"} listas para repasar.`,
        url: "/review",
      });
      try {
        await webpush.sendNotification(
          {
            endpoint: s.endpoint,
            keys: { p256dh: s.p256dh, auth: s.auth },
          },
          payload,
        );
        sent++;
      } catch (err) {
        // 404/410 = subscription is dead, browser revoked it. Anything
        // else (network blip, throttling) we just log and skip.
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          deadSubs.push(s.id);
        } else {
          console.warn(
            `[cron/daily-reminders] send failed for sub ${s.id}:`,
            err instanceof Error ? err.message : err,
          );
        }
      }
    }),
  );

  // 4. Cleanup dead subscriptions.
  if (deadSubs.length > 0) {
    await service
      .from("push_subscriptions")
      .delete()
      .in("id", deadSubs)
      .then(
        () => {},
        (e: { message?: string }) => {
          console.warn(
            "[cron/daily-reminders] dead-sub cleanup failed:",
            e?.message,
          );
        },
      );
  }

  return NextResponse.json({
    sent,
    skipped: subs.length - sent - deadSubs.length,
    cleaned_dead: deadSubs.length,
  });
}
