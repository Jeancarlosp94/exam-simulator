import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { getSupabasePublishableKey, requireEnv } from "@/lib/env";

import type { Database } from "./types";

/**
 * Supabase client for React Server Components and route handlers.
 *
 * In RSCs the cookie store is read-only; the setAll branch silently
 * swallows attempts to mutate (the middleware refresh path handles
 * session rotation). In route handlers cookies are writable and setAll
 * applies as expected.
 */
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    getSupabasePublishableKey(),
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // RSC cookie store is read-only — middleware refreshes the session.
          }
        },
      },
    },
  );
}
