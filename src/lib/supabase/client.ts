import { createBrowserClient } from "@supabase/ssr";

import {
  getClientSupabasePublishableKey,
  getClientSupabaseUrl,
} from "@/lib/env";

import type { Database } from "./types";

/**
 * Supabase client for client components ("use client").
 *
 * Uses the CLIENT-SAFE env helpers because this code ships to the browser
 * bundle, where dynamic `process.env[key]` access returns undefined. The
 * helpers reference env vars by literal property name so SWC inlines them.
 */
export function createSupabaseBrowserClient() {
  return createBrowserClient<Database>(
    getClientSupabaseUrl(),
    getClientSupabasePublishableKey(),
  );
}
