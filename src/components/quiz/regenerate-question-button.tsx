"use client";

import { Loader2, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

type Props = {
  questionId: string;
};

/**
 * Regenerates a single question in place. After the route updates the DB,
 * we call router.refresh() so the server component re-fetches and the new
 * prompt/options/explanation render — without a full page reload.
 */
export function RegenerateQuestionButton({ questionId }: Props) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function handleClick() {
    setPending(true);
    try {
      const res = await fetch("/api/quiz/regenerate-question", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question_id: questionId }),
      });
      if (!res.ok) {
        const payload = (await res.json().catch(() => ({}))) as {
          error?: string;
          detail?: string;
          retry_after_seconds?: number;
        };
        if (payload.error === "rate_limited") {
          const mins = Math.ceil((payload.retry_after_seconds ?? 60) / 60);
          toast.error(`Demasiadas regeneraciones. Volvé en ~${mins} min.`);
        } else {
          toast.error(
            `No pudimos regenerar: ${payload.detail ?? payload.error ?? "error_desconocido"}`,
          );
        }
        return;
      }
      toast.success("Pregunta regenerada.");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No pudimos regenerar.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleClick}
      disabled={pending}
    >
      {pending ? <Loader2 className="animate-spin" /> : <RefreshCw />}
      {pending ? "Regenerando..." : "Regenerar"}
    </Button>
  );
}
