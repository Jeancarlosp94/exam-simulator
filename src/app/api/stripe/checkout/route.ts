import { NextResponse } from "next/server";

import { optionalEnv, requireEnv } from "@/lib/env";
import { checkRateLimit } from "@/lib/rate-limit";
import { getStripeClient } from "@/lib/stripe";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseServiceClient } from "@/lib/supabase/service";

/**
 * POST /api/stripe/checkout
 *
 * Creates a Stripe Checkout Session for the Pro subscription and returns
 * its URL. Client redirects to that URL; Stripe handles card collection;
 * Stripe sends a webhook on completion which sync_subscriptions our row.
 *
 * Idempotency on customer: if the user already has a stripe_customer_id
 * (from a prior failed upgrade attempt), reuse it via `customer: ...`.
 * Otherwise pass `customer_email` and let Stripe create one — the
 * webhook will persist the new customer id.
 *
 * The user_id is stamped into both subscription_data.metadata AND
 * client_reference_id so the webhook can find the user even if the
 * subscription is created via a different flow later (e.g. Customer
 * Portal upgrades).
 */
export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  // Tight limit — checkout session creation hits Stripe API. A few per
  // hour covers legit "I bailed, retry" but blocks card-stuffing flood.
  const rl = await checkRateLimit(
    { prefix: "stripe-checkout", requests: 10, window: "1 h" },
    user.id,
  );
  if (!rl.ok) {
    return NextResponse.json(
      { error: "rate_limited", retry_after_seconds: rl.retryAfterSeconds },
      {
        status: 429,
        headers: { "Retry-After": String(rl.retryAfterSeconds) },
      },
    );
  }

  const priceId = requireEnv("STRIPE_PRICE_ID_PRO_MONTHLY");
  const appUrl = optionalEnv("NEXT_PUBLIC_APP_URL", "http://localhost:3000");

  // Reuse an existing Stripe customer if the user has one from a prior
  // checkout attempt (e.g. they bailed at the card screen and came back).
  const service = getSupabaseServiceClient();
  const { data: existing } = await service
    .from("subscriptions")
    .select("stripe_customer_id")
    .eq("user_id", user.id)
    .maybeSingle();

  const stripe = getStripeClient();
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${appUrl}/library?upgraded=1`,
    cancel_url: `${appUrl}/pricing?canceled=1`,
    client_reference_id: user.id,
    subscription_data: {
      metadata: { user_id: user.id },
    },
    ...(existing?.stripe_customer_id
      ? { customer: existing.stripe_customer_id }
      : user.email
        ? { customer_email: user.email }
        : {}),
    allow_promotion_codes: true,
  });

  if (!session.url) {
    return NextResponse.json(
      { error: "checkout_session_missing_url" },
      { status: 502 },
    );
  }

  return NextResponse.json({ url: session.url });
}
