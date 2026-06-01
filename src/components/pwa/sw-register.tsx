"use client";

import { useEffect } from "react";

/**
 * Registers the service worker on mount.
 *
 * - Only runs in production builds (in dev the SW would cache stale
 *   chunks across HMR and confuse everything).
 * - Idempotent — the browser handles dedupe internally if called
 *   multiple times.
 * - Best-effort; failures just log to console (never block render).
 */
export function SwRegister() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV !== "production") return;

    navigator.serviceWorker.register("/sw.js").catch((error) => {
      console.warn("[sw] registration failed", error);
    });
  }, []);

  return null;
}
