"use client";

import { Download, X } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Listens for the browser's `beforeinstallprompt` event and shows a
 * non-blocking install banner. After dismissal we suppress the prompt
 * for 14 days via localStorage so we're not annoying — most repeat
 * visits will never see it.
 *
 * The banner sits above the bottom nav (bottom-16 on mobile, bottom-4
 * elsewhere) so it doesn't clip behind it.
 */
const DISMISSED_KEY = "quizen.install_prompt_dismissed_until";
const SNOOZE_MS = 14 * 24 * 60 * 60 * 1000; // 14 days

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export function InstallPrompt() {
  const [deferredEvent, setDeferredEvent] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const dismissedUntilRaw = window.localStorage.getItem(DISMISSED_KEY);
    const dismissedUntil = dismissedUntilRaw ? Number(dismissedUntilRaw) : 0;
    if (Number.isFinite(dismissedUntil) && dismissedUntil > Date.now()) {
      return;
    }

    function handle(event: Event) {
      event.preventDefault();
      setDeferredEvent(event as BeforeInstallPromptEvent);
      setVisible(true);
    }

    window.addEventListener("beforeinstallprompt", handle);
    return () => window.removeEventListener("beforeinstallprompt", handle);
  }, []);

  function snooze() {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(
        DISMISSED_KEY,
        String(Date.now() + SNOOZE_MS),
      );
    }
    setVisible(false);
    setDeferredEvent(null);
  }

  async function install() {
    if (!deferredEvent) return;
    try {
      await deferredEvent.prompt();
      await deferredEvent.userChoice;
    } finally {
      // Whether they accepted or dismissed, the event is one-shot.
      setVisible(false);
      setDeferredEvent(null);
    }
  }

  if (!visible) return null;

  return (
    <div
      role="region"
      aria-label="Instalar Quizen"
      className={cn(
        "fixed inset-x-3 z-50 rounded-xl border border-border bg-card/95 p-3 shadow-lg backdrop-blur animate-slide-up-fade",
        "bottom-20 sm:bottom-4 sm:left-auto sm:right-4 sm:w-80",
      )}
    >
      <div className="flex items-start gap-3">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
          <Download className="size-4" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-medium">Instalá Quizen</p>
          <p className="text-xs text-muted-foreground">
            Acceso desde tu pantalla principal, sin abrir el navegador.
          </p>
        </div>
        <button
          type="button"
          onClick={snooze}
          aria-label="Descartar"
          className="rounded-md p-1 text-muted-foreground hover:bg-card hover:text-foreground"
        >
          <X className="size-4" />
        </button>
      </div>
      <div className="mt-3 flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={snooze}>
          Ahora no
        </Button>
        <Button size="sm" onClick={install}>
          <Download />
          Instalar
        </Button>
      </div>
    </div>
  );
}
