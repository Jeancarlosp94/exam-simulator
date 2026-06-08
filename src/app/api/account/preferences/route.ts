import { NextResponse } from "next/server";
import { z } from "zod";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseServiceClient } from "@/lib/supabase/service";

/**
 * POST /api/account/preferences
 * Body: { email_reminder_enabled?: boolean }
 *
 * Updates user preferences on profiles. Currently just the email
 * reminder opt-in; extend as more preferences land.
 */
export const runtime = "nodejs";
export const maxDuration = 10;

const Body = z.object({
  email_reminder_enabled: z.boolean().optional(),
});

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
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

  const updates: { email_reminder_enabled?: boolean } = {};
  if (parsed.data.email_reminder_enabled !== undefined) {
    updates.email_reminder_enabled = parsed.data.email_reminder_enabled;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ ok: true, noop: true });
  }

  const service = getSupabaseServiceClient();
  const { error } = await service
    .from("profiles")
    .update(updates)
    .eq("id", user.id);

  if (error) {
    return NextResponse.json(
      { error: "update_failed", detail: error.message },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
