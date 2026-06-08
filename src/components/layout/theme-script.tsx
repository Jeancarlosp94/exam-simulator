"use client";

/**
 * Hydration-safe theme bootstrap. The cookie is already read server-side
 * in layout.tsx so the html element ships with the correct data-attrs.
 * This module only handles client-side mutations (via the picker or
 * quick toggle): updates DOM, updates cookie, broadcasts an event so
 * other components (like the floating ModeToggle) can re-read state.
 */

import { serializeTheme, THEME_CHANGE_EVENT, THEME_COOKIE } from "@/lib/theme";
import type { ThemeSettings } from "@/lib/supabase/types";

export function applyThemeToDom(t: ThemeSettings) {
  if (typeof document === "undefined") return;
  const html = document.documentElement;
  html.dataset.palette = t.palette;
  html.dataset.mode = t.mode;
  if (t.brightness === "dark") {
    html.classList.add("dark");
    html.classList.remove("light");
  } else {
    html.classList.add("light");
    html.classList.remove("dark");
  }
  document.cookie = `${THEME_COOKIE}=${serializeTheme(t)}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`;
  window.dispatchEvent(new CustomEvent(THEME_CHANGE_EVENT, { detail: t }));
}
