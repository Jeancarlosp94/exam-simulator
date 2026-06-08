import { NextResponse } from "next/server";
import { z } from "zod";

import { checkRateLimit } from "@/lib/rate-limit";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseServiceClient } from "@/lib/supabase/service";

/**
 * POST /api/profile/theme
 * Body: { palette, mode, brightness }
 *
 * Persists the chosen theme to profiles.theme_settings so it follows the
 * user across devices. The cookie is the fast path and is set client-
 * side immediately; this endpoint is the durable mirror.
 */
export const runtime = "nodejs";
export const maxDuration = 10;

const Body = z.object({
  palette: z.enum(["teal", "forest", "sunset", "lavender"]),
  mode: z.enum(["focus", "relax"]),
  brightness: z.enum(["dark", "light"]),
});

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const rl = await checkRateLimit(
    { prefix: "theme", requests: 60, window: "1 h" },
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

  const service = getSupabaseServiceClient();
  const { error } = await service
    .from("profiles")
    .update({ theme_settings: parsed.data })
    .eq("id", user.id);

  if (error) {
    return NextResponse.json(
      { error: "update_failed", detail: error.message },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
