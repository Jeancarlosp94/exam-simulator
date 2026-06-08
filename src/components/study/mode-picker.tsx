"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { STUDY_MODE_LIST, type StudyMode } from "@/lib/study/modes";

type Props = {
  documentId: string;
};

export function ModePicker({ documentId }: Props) {
  const router = useRouter();
  const [pendingMode, setPendingMode] = useState<StudyMode | null>(null);

  async function start(mode: StudyMode) {
    setPendingMode(mode);
    try {
      const res = await fetch("/api/study/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ document_id: documentId, mode }),
      });
      if (!res.ok) {
        const payload = (await res.json().catch(() => ({}))) as {
          error?: string;
          detail?: string;
          retry_after_seconds?: number;
        };
        if (payload.error === "rate_limited") {
          const mins = Math.ceil((payload.retry_after_seconds ?? 60) / 60);
          toast.error(`Esperá ~${mins} min antes de empezar otra sesión.`);
        } else {
          toast.error(
            `No pudimos arrancar la sesión: ${payload.detail ?? payload.error ?? "error_desconocido"}`,
          );
        }
        return;
      }
      const { session_id } = (await res.json()) as { session_id: string };
      router.push(`/study/${documentId}/guide/${session_id}`);
    } finally {
      setPendingMode(null);
    }
  }

  return (
    <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {STUDY_MODE_LIST.map((mode) => {
        const isPending = pendingMode === mode.id;
        const anyPending = pendingMode !== null;
        return (
          <Card
            key={mode.id}
            className={cn(
              "transition-all duration-100",
              !anyPending &&
                "hover:border-primary/40 hover:bg-card/70 active:scale-[0.98]",
            )}
          >
            <CardContent className="flex h-full flex-col gap-3 py-5">
              <div className="flex items-baseline gap-2">
                <span className="text-2xl" aria-hidden>
                  {mode.emoji}
                </span>
                <h3 className="text-base font-semibold">{mode.name}</h3>
                <span className="ml-auto text-xs text-muted-foreground">
                  ~{mode.estimatedMinutes} min
                </span>
              </div>
              <p className="text-sm text-muted-foreground">
                {mode.description}
              </p>
              <p className="text-xs text-muted-foreground">
                <strong>Para:</strong> {mode.audience}
              </p>
              <p className="text-xs italic text-muted-foreground/80">
                {mode.evidenceNote}
              </p>
              <div className="mt-auto pt-2">
                <Button
                  className="w-full"
                  onClick={() => start(mode.id)}
                  disabled={anyPending}
                >
                  {isPending ? (
                    <>
                      <Loader2 className="animate-spin" />
                      Preparando guía...
                    </>
                  ) : (
                    `Empezar ${mode.name}`
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </section>
  );
}
