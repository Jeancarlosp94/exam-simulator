import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { requireEnv } from "@/lib/env";

import type { Database } from "./types";

/**
 * Refreshes the Supabase auth session on every request and forwards the
 * rotated cookies back to the browser. Must run before any auth-gated
 * route reads the session, otherwise expired tokens leak through.
 *
 * Critical: do not insert any logic between createServerClient and
 * getUser — Supabase's docs explicitly warn against it.
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  await supabase.auth.getUser();

  return supabaseResponse;
}
