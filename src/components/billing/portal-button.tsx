"use client";

import { Settings } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

/**
 * Opens Stripe's hosted Customer Portal for self-service subscription
 * management (cancel, change card, see invoices).
 */
export function PortalButton({
  label = "Gestionar suscripción",
  variant = "outline",
  size,
}: {
  label?: string;
  variant?: "default" | "outline" | "ghost";
  size?: "default" | "sm" | "lg";
}) {
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    setLoading(true);
    const response = await fetch("/api/stripe/portal", { method: "POST" });
    if (!response.ok) {
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
      };
      toast.error(`No pudimos abrir el portal: ${payload.error ?? "error"}`);
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
      variant={variant}
      size={size}
    >
      <Settings />
      {loading ? "Redirigiendo..." : label}
    </Button>
  );
}
