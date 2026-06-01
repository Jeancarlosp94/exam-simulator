import { createClient } from "@supabase/supabase-js";

import { getSupabaseSecretKey, requireEnv } from "@/lib/env";

import type { Database } from "./types";

/**
 * Server-only secret client (formerly "service role"). Bypasses RLS.
 * NEVER import this from a "use client" file or any module that ends
 * up in the client bundle — it carries the secret key.
 *
 * Used in API routes that need to:
 *  - Bulk-insert into tables without per-row insert policies (e.g.
 *    document_chunks, questions).
 *  - Download user-scoped objects from Storage on behalf of a verified
 *    user (we still validate ownership manually before doing so).
 *  - Write to subscriptions from the Stripe webhook handler.
 */
let cached: ReturnType<typeof createClient<Database>> | null = null;

export function getSupabaseServiceClient() {
  if (cached) return cached;
  cached = createClient<Database>(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    getSupabaseSecretKey(),
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
  return cached;
}
