"use client";

import { Sparkles } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

/**
 * Client-side "Upgrade to Pro" button. Hits /api/stripe/checkout, gets
 * the session URL back, redirects via window.location.href (full
 * document navigation — Stripe Checkout is not embeddable).
 */
export function UpgradeButton({
  label = "Pasar a Pro",
  className,
  size,
}: {
  label?: string;
  className?: string;
  size?: "default" | "sm" | "lg";
}) {
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    setLoading(true);
    const response = await fetch("/api/stripe/checkout", { method: "POST" });
    if (!response.ok) {
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
      };
      toast.error(
        `No pudimos iniciar el checkout: ${payload.error ?? "error"}`,
      );
      setLoading(false);
      return;
    }
    const { url } = (await response.json()) as { url: string };
    window.location.href = url;
  }

  return (
    <Button
      onClick={handleClick}
      disabled={loading}
      size={size}
      className={className}
    >
      <Sparkles />
      {loading ? "Redirigiendo..." : label}
    </Button>
  );
}
