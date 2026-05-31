import type { MetadataRoute } from "next";

import { optionalEnv } from "@/lib/env";

/**
 * Robots policy:
 *   - Allow crawling of the marketing surfaces.
 *   - Disallow auth-gated routes and the entire /api/ tree. Crawling
 *     those produces 401/500s in logs and never returns useful content
 *     for search indexes anyway.
 */
export default function robots(): MetadataRoute.Robots {
  const base = optionalEnv("NEXT_PUBLIC_APP_URL", "https://quizen.app");
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/pricing", "/login"],
        disallow: [
          "/api/",
          "/library",
          "/upload",
          "/quiz/",
          "/review",
          "/auth/",
        ],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
  };
}
