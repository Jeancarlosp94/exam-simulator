"use client";

import { Leaf, Target } from "lucide-react";
import { useSyncExternalStore } from "react";

import { applyThemeToDom } from "@/components/layout/theme-script";
import { parseTheme, THEME_CHANGE_EVENT, THEME_COOKIE } from "@/lib/theme";
import type { ThemeMode } from "@/lib/supabase/types";

/**
 * Tiny focus↔relax toggle. Mirrors the cookie state and flips it on
 * click. Lives in the floating UI (top-right of the app shell) so it's
 * one tap to switch between deep-work intensity and reading comfort.
 *
 * Reads the cookie via useSyncExternalStore (the React 19 way to sync
 * with external storage without setState-in-effect). Subscribes to the
 * THEME_CHANGE_EVENT broadcast from applyThemeToDom so the icon flips
 * when the picker in /account changes the mode.
 *
 * Best-effort persistence: cookie + DOM update synchronously; the DB
 * mirror happens in the background.
 */

function readMode(): ThemeMode {
  const cookie = document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${THEME_COOKIE}=`))
    ?.split("=")[1];
  return parseTheme(cookie).mode;
}

function subscribe(callback: () => void): () => void {
  window.addEventListener(THEME_CHANGE_EVENT, callback);
  return () => window.removeEventListener(THEME_CHANGE_EVENT, callback);
}

// Server snapshot — focus is the default in DEFAULT_THEME. The real
// value paints right after hydration via useSyncExternalStore.
const getServerSnapshot = (): ThemeMode => "focus";

export function ModeToggle() {
  const mode = useSyncExternalStore(subscribe, readMode, getServerSnapshot);

  function toggle() {
    const cookie = document.cookie
      .split("; ")
      .find((row) => row.startsWith(`${THEME_COOKIE}=`))
      ?.split("=")[1];
    const current = parseTheme(cookie);
    const next: ThemeMode = current.mode === "focus" ? "relax" : "focus";
    const nextTheme = { ...current, mode: next };
    applyThemeToDom(nextTheme);
    // Fire-and-forget persistence; cookie + DOM are already updated.
    void fetch("/api/profile/theme", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(nextTheme),
    }).catch(() => {});
  }

  const Icon = mode === "focus" ? Target : Leaf;
  const label = mode === "focus" ? "Cambiar a Relajado" : "Cambiar a Enfocado";

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={label}
      title={label}
      className="fixed right-3 top-3 z-30 flex size-9 items-center justify-center rounded-full border border-border bg-card/80 text-muted-foreground shadow-sm backdrop-blur transition-colors hover:bg-card hover:text-foreground"
    >
      <Icon className="size-4" />
    </button>
  );
}
