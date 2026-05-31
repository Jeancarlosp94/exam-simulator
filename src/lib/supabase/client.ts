import { createBrowserClient } from "@supabase/ssr";

import { requireEnv } from "@/lib/env";

import type { Database } from "./types";

/**
 * Supabase client for client components ("use client").
 * Anon key + RLS only. Never use the service role key here.
 */
export function createSupabaseBrowserClient() {
  return createBrowserClient<Database>(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
  );
}
