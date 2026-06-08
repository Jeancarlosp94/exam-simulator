import { NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";

import { logSecurityEvent } from "@/lib/guard";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Auth callback for both flows Supabase uses:
 *
 *   1. OAuth providers (Google, etc.) → ?code=XXX → exchangeCodeForSession
 *   2. Magic links (email OTP) → ?token_hash=XXX&type=magiclink → verifyOtp
 *
 * Modern Supabase magic links use the token_hash flow by default — the
 * code-only handler from the OAuth-style example silently fails for them.
 *
 * On any failure we redirect back to /login with ?error=auth_failed
 * AND ?detail=<reason> so we can see in the URL what went wrong.
 *
 * Security: `next` is whitelisted to in-app paths. An attacker who
 * crafts ?next=//evil.com or ?next=https://evil.com could otherwise turn
 * /auth/callback into an open redirect, useful for phishing.
 */
function safeNext(raw: string | null): string {
  if (!raw) return "/library";
  // Must start with a single "/" — not "//" (protocol-relative),
  // backslash trick, or absolute URL.
  if (!raw.startsWith("/")) return "/library";
  if (raw.startsWith("//") || raw.startsWith("/\\")) return "/library";
  // Reject any control chars that some browsers may collapse.
  if (/[\x00-\x1f]/.test(raw)) return "/library";
  return raw;
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const next = safeNext(searchParams.get("next"));

  // ── Flow 1: OAuth / PKCE — has `code` ─────────────────────────────────
  const code = searchParams.get("code");
  if (code) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
    return NextResponse.redirect(
      `${origin}/login?error=auth_failed&detail=${encodeURIComponent(`exchange_code: ${error.message}`)}`,
    );
  }

  // ── Flow 2: Magic link / email OTP — has `token_hash` + `type` ───────
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  if (token_hash && type) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash });
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
    return NextResponse.redirect(
      `${origin}/login?error=auth_failed&detail=${encodeURIComponent(`verify_otp: ${error.message}`)}`,
    );
  }

  // ── Neither flow matched — link is malformed or already used ─────────
  logSecurityEvent({ kind: "auth_failed", route: "/auth/callback" });
  return NextResponse.redirect(
    `${origin}/login?error=auth_failed&detail=no_code_or_token`,
  );
}
