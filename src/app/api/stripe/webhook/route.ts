import { NextResponse } from "next/server";
import type Stripe from "stripe";

import { requireEnv } from "@/lib/env";
import { logSecurityEvent } from "@/lib/guard";
import { getStripeClient } from "@/lib/stripe";
import { getSupabaseServiceClient } from "@/lib/supabase/service";

/**
 * POST /api/stripe/webhook
 *
 * Receives Stripe events and syncs them to public.subscriptions.
 *
 * Critical: verify the signature with stripe.webhooks.constructEvent
 * against the RAW request body. Body must NOT be parsed before
 * verification or the HMAC won't match.
 *
 * Events we handle:
 *   - checkout.session.completed: initial upgrade, persist customer +
 *     subscription ids, set plan=pro/status=active.
 *   - customer.subscription.updated: status changes (active, past_due,
 *     canceled, trialing), renewals, plan changes.
 *   - customer.subscription.deleted: final cancellation, downgrade row
 *     to plan=free/status=canceled.
 *
 * The webhook is the authoritative writer for public.subscriptions —
 * client-side code never INSERTs/UPDATEs that table, RLS allows reads
 * only.
 */
export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "missing_signature" }, { status: 400 });
  }

  const rawBody = await request.text();
  const stripe = getStripeClient();
  const webhookSecret = requireEnv("STRIPE_WEBHOOK_SECRET");

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "signature_verification_failed";
    logSecurityEvent({
      kind: "invalid_signature",
      route: "/api/stripe/webhook",
      provider: "stripe",
    });
    return NextResponse.json(
      { error: "invalid_signature", detail: message },
      { status: 400 },
    );
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutCompleted(event.data.object);
        break;

      case "customer.subscription.updated":
      case "customer.subscription.created":
        await handleSubscriptionUpdated(event.data.object);
        break;

      case "customer.subscription.deleted":
        await handleSubscriptionDeleted(event.data.object);
        break;

      default:
        // Many event types fire (invoice.*, payment_intent.*, ...). We
        // intentionally ignore them — the three above cover the full
        // subscriptions sync. Returning 200 tells Stripe not to retry.
        break;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "handler_failed";
    // Return 500 so Stripe retries with exponential backoff. Better to
    // retry a transient DB failure than to silently drop a billing event.
    return NextResponse.json(
      { error: "handler_failed", detail: message },
      { status: 500 },
    );
  }

  return NextResponse.json({ received: true });
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const userId = session.client_reference_id ?? session.metadata?.user_id;
  if (!userId) {
    throw new Error(
      "checkout_session_missing_user_id: cannot link to a Quizen user",
    );
  }
  const customerId =
    typeof session.customer === "string"
      ? session.customer
      : (session.customer?.id ?? null);
  if (!customerId) {
    throw new Error("checkout_session_missing_customer");
  }
  const subscriptionId =
    typeof session.subscription === "string"
      ? session.subscription
      : (session.subscription?.id ?? null);

  const service = getSupabaseServiceClient();
  const { error } = await service.from("subscriptions").upsert(
    {
      user_id: userId,
      stripe_customer_id: customerId,
      stripe_subscription_id: subscriptionId,
      plan: "pro",
      status: "active",
      cancel_at_period_end: false,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );
  if (error) throw new Error(`subscriptions_upsert_failed: ${error.message}`);
}

type SchemaStatus = "free" | "active" | "past_due" | "canceled" | "trialing";

/**
 * Stripe has more subscription statuses than our schema's CHECK constraint
 * allows. Collapse the extras into the closest match:
 *   - incomplete / incomplete_expired → past_due (payment pending/failed)
 *   - unpaid / paused → past_due (lost grace period)
 * If Stripe ever adds a new status, this falls back to past_due so we
 * never reject a webhook because of a status string we don't recognize.
 */
function mapStripeStatus(
  stripeStatus: Stripe.Subscription.Status,
): SchemaStatus {
  switch (stripeStatus) {
    case "active":
    case "past_due":
    case "canceled":
    case "trialing":
      return stripeStatus;
    case "incomplete":
    case "incomplete_expired":
    case "unpaid":
    case "paused":
      return "past_due";
    default:
      return "past_due";
  }
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  const userId = subscription.metadata?.user_id;
  const customerId =
    typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer.id;
  if (!userId) {
    throw new Error(`subscription_${subscription.id}_missing_user_id_metadata`);
  }

  const service = getSupabaseServiceClient();
  const periodEnd =
    "current_period_end" in subscription &&
    typeof subscription.current_period_end === "number"
      ? new Date(subscription.current_period_end * 1000).toISOString()
      : null;

  const schemaStatus = mapStripeStatus(subscription.status);

  const { error } = await service.from("subscriptions").upsert(
    {
      user_id: userId,
      stripe_customer_id: customerId,
      stripe_subscription_id: subscription.id,
      plan: schemaStatus === "canceled" ? "free" : "pro",
      status: schemaStatus,
      current_period_end: periodEnd,
      cancel_at_period_end: subscription.cancel_at_period_end,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );
  if (error) throw new Error(`subscriptions_upsert_failed: ${error.message}`);
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const userId = subscription.metadata?.user_id;
  if (!userId) return; // Nothing to do if we can't find the user

  const service = getSupabaseServiceClient();
  const { error } = await service
    .from("subscriptions")
    .update({
      plan: "free",
      status: "canceled",
      cancel_at_period_end: false,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId);
  if (error)
    throw new Error(`subscriptions_downgrade_failed: ${error.message}`);
}
