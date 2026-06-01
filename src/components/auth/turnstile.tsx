"use client";

import Script from "next/script";
import { useEffect, useRef } from "react";

/**
 * Cloudflare Turnstile widget — free, no Google tracking, no user friction
 * on most loads (Cloudflare's risk model usually solves invisibly).
 *
 * Renders only when NEXT_PUBLIC_TURNSTILE_SITE_KEY is set, so dev / local
 * setups without Cloudflare configured don't see a broken widget. The
 * caller passes onVerify(token); pass the token to Supabase's
 * signInWithOtp({ options: { captchaToken } }) and Supabase will verify
 * it server-side with the secret you configured in Supabase Auth → Bot
 * and Abuse Protection.
 */

// Static access so SWC can inline NEXT_PUBLIC_* into the client bundle.
const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

// Module-augmentation type for Cloudflare's global API surface.
declare global {
  interface Window {
    turnstile?: {
      render: (
        container: string | HTMLElement,
        options: {
          sitekey: string;
          callback?: (token: string) => void;
          "expired-callback"?: () => void;
          "error-callback"?: () => void;
          theme?: "light" | "dark" | "auto";
          size?: "normal" | "flexible" | "compact";
        },
      ) => string;
      reset: (widgetId?: string) => void;
    };
  }
}

type TurnstileProps = {
  /** Called with the token when the user passes the challenge. */
  onVerify: (token: string) => void;
  /** Called when the token expires (user must re-verify). */
  onExpire?: () => void;
};

export function Turnstile({ onVerify, onExpire }: TurnstileProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!SITE_KEY) return;
    if (!containerRef.current) return;
    if (typeof window === "undefined" || !window.turnstile) return;
    if (widgetIdRef.current !== null) return; // already rendered

    widgetIdRef.current = window.turnstile.render(containerRef.current, {
      sitekey: SITE_KEY,
      callback: onVerify,
      "expired-callback": onExpire,
      theme: "dark",
      size: "flexible",
    });
  }, [onVerify, onExpire]);

  // If no site key configured, render nothing — the parent component
  // should handle the no-captcha case via `isTurnstileEnabled()`.
  if (!SITE_KEY) return null;

  return (
    <>
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js"
        strategy="afterInteractive"
        async
        defer
      />
      <div ref={containerRef} className="flex justify-center" />
    </>
  );
}

/**
 * True when the Turnstile site key is configured. Use this to decide
 * whether to require a captcha token before submitting the auth form.
 */
export function isTurnstileEnabled(): boolean {
  return Boolean(SITE_KEY);
}
