import { NextResponse } from "next/server";

import { optionalEnv } from "@/lib/env";
import { getStripeClient } from "@/lib/stripe";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseServiceClient } from "@/lib/supabase/service";

/**
 * POST /api/stripe/portal
 *
 * Opens a Stripe Customer Portal session so the user can manage their
 * subscription (cancel, update card, see invoices). Returns the portal
 * URL — client redirects.
 *
 * The Portal is the right surface for self-service. Avoid building
 * in-app billing UI when Stripe ships it for free.
 */
export const runtime = "nodejs";
export const maxDuration = 15;

export async function POST() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const service = getSupabaseServiceClient();
  const { data: subscription } = await service
    .from("subscriptions")
    .select("stripe_customer_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!subscription?.stripe_customer_id) {
    return NextResponse.json({ error: "no_customer" }, { status: 404 });
  }

  const appUrl = optionalEnv("NEXT_PUBLIC_APP_URL", "http://localhost:3000");
  const stripe = getStripeClient();
  const session = await stripe.billingPortal.sessions.create({
    customer: subscription.stripe_customer_id,
    return_url: `${appUrl}/library`,
  });

  return NextResponse.json({ url: session.url });
}
