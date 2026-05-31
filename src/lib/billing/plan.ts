import { getSupabaseServiceClient } from "@/lib/supabase/service";

/**
 * Quizen subscription plans.
 *
 * Free is the implicit default — users without a row in public.subscriptions
 * are treated as free. This lets us skip writing free rows at signup and
 * keeps onboarding stateless. A subscriptions row is created only when the
 * user upgrades via Stripe Checkout.
 */

export type PlanId = "free" | "pro";

export type PlanLimits = {
  /** Max documents the user can upload in a calendar month. */
  documentsPerMonth: number;
  /** Max questions a single quiz can have. */
  questionsPerQuiz: number;
};

export const PLAN_LIMITS: Record<PlanId, PlanLimits> = {
  free: {
    documentsPerMonth: 3,
    questionsPerQuiz: 20,
  },
  pro: {
    documentsPerMonth: 30,
    questionsPerQuiz: 30,
  },
};

export const PLAN_LABELS: Record<PlanId, string> = {
  free: "Free",
  pro: "Pro",
};

/**
 * Status values that grant Pro access. Anything else (canceled, past_due,
 * trialing-with-payment-failed, ...) silently falls back to free.
 */
const PRO_ACTIVE_STATUSES = new Set(["active", "trialing"]);

type UserPlan = {
  plan: PlanId;
  limits: PlanLimits;
  /** Raw status from subscriptions row, or 'free' if no row. */
  status: string;
  /** When the current billing period ends. null for free users. */
  current_period_end: string | null;
  /** Whether the user has scheduled cancellation at period end. */
  cancel_at_period_end: boolean;
  /** Stripe customer id, if any — used to open the portal. */
  stripe_customer_id: string | null;
};

/**
 * Resolve the effective plan for a user. Reads the subscriptions row via
 * the service client (bypassing RLS — server-only function, never call
 * from a "use client" module).
 *
 * Cheap: single indexed primary-key lookup.
 */
export async function getUserPlan(userId: string): Promise<UserPlan> {
  const service = getSupabaseServiceClient();
  const { data: row } = await service
    .from("subscriptions")
    .select(
      "plan, status, current_period_end, cancel_at_period_end, stripe_customer_id",
    )
    .eq("user_id", userId)
    .maybeSingle();

  if (!row) {
    return {
      plan: "free",
      limits: PLAN_LIMITS.free,
      status: "free",
      current_period_end: null,
      cancel_at_period_end: false,
      stripe_customer_id: null,
    };
  }

  const isProActive = row.plan === "pro" && PRO_ACTIVE_STATUSES.has(row.status);

  const effectivePlan: PlanId = isProActive ? "pro" : "free";

  return {
    plan: effectivePlan,
    limits: PLAN_LIMITS[effectivePlan],
    status: row.status,
    current_period_end: row.current_period_end,
    cancel_at_period_end: row.cancel_at_period_end,
    stripe_customer_id: row.stripe_customer_id,
  };
}

/**
 * Count documents the user uploaded in the current calendar month.
 * Used to enforce the documentsPerMonth limit at upload time.
 */
export async function countDocumentsThisMonth(userId: string): Promise<number> {
  const service = getSupabaseServiceClient();
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const { count, error } = await service
    .from("documents")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", startOfMonth.toISOString());
  if (error || count == null) return 0;
  return count;
}
