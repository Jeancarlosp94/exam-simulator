import { NextResponse } from "next/server";
import { z } from "zod";

import { generateShareSlug } from "@/lib/quiz/slug";
import { checkRateLimit } from "@/lib/rate-limit";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseServiceClient } from "@/lib/supabase/service";

/**
 * POST /api/quiz/share
 * Body: { quiz_id: string }
 *
 * Mints a public share link for an existing quiz the caller owns.
 * Idempotent-ish: returns the most recent existing share if one is
 * already active (no expires_at, or expires in the future), so clicking
 * "Compartir" twice doesn't litter the table with dead slugs.
 *
 * Returns: { slug, url }.
 */
export const runtime = "nodejs";
export const maxDuration = 10;

const Body = z.object({ quiz_id: z.string().uuid() });

const SLUG_INSERT_RETRIES = 5;

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const rateLimit = await checkRateLimit(
    { prefix: "quiz-share", requests: 30, window: "1 h" },
    user.id,
  );
  if (!rateLimit.ok) {
    return NextResponse.json(
      {
        error: "rate_limited",
        retry_after_seconds: rateLimit.retryAfterSeconds,
      },
      {
        status: 429,
        headers: { "Retry-After": String(rateLimit.retryAfterSeconds) },
      },
    );
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const parsed = Body.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_body", issues: parsed.error.issues },
      { status: 400 },
    );
  }
  const { quiz_id } = parsed.data;

  const service = getSupabaseServiceClient();

  const { data: quiz, error: quizError } = await service
    .from("quizzes")
    .select("id, user_id")
    .eq("id", quiz_id)
    .single();
  if (quizError || !quiz) {
    return NextResponse.json({ error: "quiz_not_found" }, { status: 404 });
  }
  if (quiz.user_id !== user.id) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  // If an active share already exists for this quiz, reuse it. Two reasons:
  //  - Clicking "Compartir" repeatedly shouldn't grow the table forever.
  //  - The user expects the same link if they share, copy, share again.
  const { data: existing } = await service
    .from("public_quiz_shares")
    .select("slug, expires_at")
    .eq("quiz_id", quiz_id)
    .eq("created_by", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing) {
    const stillActive =
      existing.expires_at === null ||
      new Date(existing.expires_at).getTime() > Date.now();
    if (stillActive) {
      return NextResponse.json({
        slug: existing.slug,
        url: shareUrl(request, existing.slug),
      });
    }
  }

  // Generate a fresh slug, retrying on the (very rare) collision.
  for (let attempt = 0; attempt < SLUG_INSERT_RETRIES; attempt++) {
    const slug = generateShareSlug();
    const { error: insertError } = await service
      .from("public_quiz_shares")
      .insert({ slug, quiz_id, created_by: user.id });

    if (!insertError) {
      return NextResponse.json({ slug, url: shareUrl(request, slug) });
    }
    // 23505 = unique_violation on the PK. Anything else is a real error.
    const code = (insertError as { code?: string }).code;
    if (code !== "23505") {
      return NextResponse.json(
        { error: "share_insert_failed", detail: insertError.message },
        { status: 500 },
      );
    }
  }

  return NextResponse.json({ error: "slug_collision_giveup" }, { status: 500 });
}

function shareUrl(request: Request, slug: string): string {
  // Prefer the incoming origin so previews share the right host; fall back
  // to NEXT_PUBLIC_APP_URL for service-to-service contexts.
  const origin =
    new URL(request.url).origin ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "https://localhost:3000";
  return `${origin}/q/${slug}`;
}
