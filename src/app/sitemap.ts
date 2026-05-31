import type { MetadataRoute } from "next";

import { optionalEnv } from "@/lib/env";

/**
 * Static sitemap. Only public marketing surfaces are listed — auth-gated
 * routes (/library, /quiz/[id], /review) don't belong in a sitemap and
 * shouldn't be indexed.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = optionalEnv("NEXT_PUBLIC_APP_URL", "https://quizen.app");
  const now = new Date();
  return [
    {
      url: `${base}/`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${base}/pricing`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${base}/login`,
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.3,
    },
  ];
}
