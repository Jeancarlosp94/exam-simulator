"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Server-side Google OAuth initiation. Works without JavaScript — the
 * login button is a <form action={signInWithGoogle}> so even iOS Safari
 * users whose client bundle is mid-hydration get a working login on tap.
 *
 * Flow:
 *  1. Server gets the OAuth provider URL from Supabase + sets the PKCE
 *     code_verifier cookie via the ssr cookies adapter.
 *  2. We redirect the user's browser to that URL (302).
 *  3. After Google, the browser comes back to /auth/callback?code=XXX
 *     where the existing handler exchanges the code (read code_verifier
 *     cookie set in step 1).
 */
export async function signInWithGoogle() {
  // Compute the redirect origin server-side. Prefer the request host so
  // preview deploys redirect back to themselves; fall back to env.
  const hdrs = await headers();
  const host = hdrs.get("x-forwarded-host") ?? hdrs.get("host");
  const proto = hdrs.get("x-forwarded-proto") ?? "https";
  const origin =
    host !== null
      ? `${proto}://${host}`
      : (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000");

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${origin}/auth/callback`,
    },
  });

  if (error) {
    // Surface to the user via the standard query-param error pattern.
    redirect(
      `/login?error=oauth_failed&detail=${encodeURIComponent(error.message)}`,
    );
  }
  if (!data?.url) {
    redirect(`/login?error=oauth_failed&detail=no_redirect_url`);
  }

  // Send the user to Google's consent screen.
  redirect(data.url);
}
