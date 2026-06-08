"use client";

import { useState } from "react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";

type Props = {
  initial: boolean;
  /** When false (no email provider configured server-side), the toggle is
   * disabled and shows a helper note. Lets the user see the option exists
   * without us silently swallowing their "yes please" preference. */
  available: boolean;
};

/**
 * Email reminder opt-in switch. Simple toggle backed by
 * POST /api/account/preferences. The actual send is in a separate cron
 * route — the toggle just records intent.
 */
export function ReminderToggle({ initial, available }: Props) {
  const [enabled, setEnabled] = useState(initial);
  const [pending, setPending] = useState(false);

  async function toggle() {
    if (!available || pending) return;
    const next = !enabled;
    setEnabled(next);
    setPending(true);
    try {
      const res = await fetch("/api/account/preferences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email_reminder_enabled: next }),
      });
      if (!res.ok) {
        toast.error("No pudimos guardar la preferencia.");
        setEnabled(!next); // revert
      }
    } catch {
      toast.error("No pudimos guardar la preferencia.");
      setEnabled(!next);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        disabled={!available || pending}
        onClick={toggle}
        className={cn(
          "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors",
          enabled ? "bg-primary" : "bg-secondary",
          (!available || pending) && "opacity-50 cursor-not-allowed",
        )}
      >
        <span
          className={cn(
            "inline-block size-5 rounded-full bg-background shadow-sm transition-transform",
            enabled ? "translate-x-5" : "translate-x-0.5",
          )}
        />
      </button>
      <span className="text-sm">{enabled ? "Activado" : "Desactivado"}</span>
    </div>
  );
}
