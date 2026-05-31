import type { NextRequest } from "next/server";

import { updateSession } from "@/lib/supabase/middleware";

/**
 * Edge proxy (the file convention formerly known as `middleware`).
 * Renamed in Next.js 16 — see
 * https://nextjs.org/docs/messages/middleware-to-proxy
 *
 * Runs before every matched request to refresh the Supabase session and
 * forward rotated cookies. The actual work lives in lib/supabase so it
 * can be unit-tested without spinning up the edge runtime.
 */
export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  /**
   * Match all paths except:
   *  - _next/static (build assets)
   *  - _next/image (image optimization)
   *  - favicon.ico, sitemap.xml, robots.txt
   *  - public image extensions
   *
   * Auth callback routes are intentionally matched so the session rotation
   * lands before the redirect.
   */
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
