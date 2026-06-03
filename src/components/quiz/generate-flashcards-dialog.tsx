"use client";

import { Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Props = {
  documentId: string;
  documentTitle: string;
  trigger: React.ReactNode;
};

export function GenerateFlashcardsDialog({
  documentId,
  documentTitle,
  trigger,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState(25);
  const [submitting, setSubmitting] = useState(false);

  async function handleGenerate() {
    setSubmitting(true);

    const response = await fetch("/api/flashcards/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ document_id: documentId, count }),
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        detail?: string;
        retry_after_seconds?: number;
      };
      if (payload.error === "rate_limited") {
        const mins = Math.ceil((payload.retry_after_seconds ?? 60) / 60);
        toast.error(
          `Has alcanzado el límite de generaciones. Volvé en ~${mins} min.`,
        );
      } else {
        toast.error(
          `No pudimos generar las tarjetas: ${payload.detail ?? payload.error ?? "error_desconocido"}`,
        );
      }
      setSubmitting(false);
      return;
    }

    const { flashcards_count } = (await response.json()) as {
      flashcards_count: number;
    };

    toast.success(`Listo: ${flashcards_count} tarjetas generadas.`);
    setOpen(false);
    setSubmitting(false);
    router.push(`/study/${documentId}`);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !submitting && setOpen(next)}>
      <DialogTrigger render={trigger as React.ReactElement} />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Generar tarjetas de estudio</DialogTitle>
          <DialogDescription className="truncate">
            Desde &quot;{documentTitle}&quot;. La generación tarda entre 10 y 45
            segundos.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          <div className="space-y-2">
            <Label htmlFor="flashcard-count">Número de tarjetas</Label>
            <Input
              id="flashcard-count"
              type="number"
              min={10}
              max={50}
              value={count}
              onChange={(event) => {
                const next = Number.parseInt(event.target.value, 10);
                if (Number.isFinite(next)) {
                  setCount(Math.max(10, Math.min(50, next)));
                }
              }}
              disabled={submitting}
            />
            <p className="text-xs text-muted-foreground">
              Entre 10 y 50. Recomendado: ~25 por documento.
            </p>
          </div>

          <p className="text-xs text-muted-foreground">
            Las tarjetas entran a tu cola de repaso. Las que marques como
            difíciles vuelven antes; las fáciles se espacian más.
          </p>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={submitting}
          >
            Cancelar
          </Button>
          <Button onClick={handleGenerate} disabled={submitting}>
            <Sparkles />
            {submitting ? "Generando..." : "Generar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
