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
import { cn } from "@/lib/utils";

type Difficulty = "easy" | "mixed" | "hard";

const DIFFICULTY_OPTIONS: ReadonlyArray<{
  value: Difficulty;
  label: string;
  description: string;
}> = [
  {
    value: "easy",
    label: "Fácil",
    description: "Recordar + comprender. Para repaso inicial.",
  },
  {
    value: "mixed",
    label: "Mixto",
    description: "Bloom balanceado. Lo recomendado.",
  },
  {
    value: "hard",
    label: "Difícil",
    description: "Aplicar + analizar + evaluar. Para examen final.",
  },
];

type Props = {
  documentId: string;
  documentTitle: string;
  trigger: React.ReactNode;
};

export function GenerateQuizDialog({
  documentId,
  documentTitle,
  trigger,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState(15);
  const [difficulty, setDifficulty] = useState<Difficulty>("mixed");
  const [submitting, setSubmitting] = useState(false);

  async function handleGenerate() {
    setSubmitting(true);

    const response = await fetch("/api/quiz/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        document_id: documentId,
        count,
        difficulty,
      }),
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
          `Has alcanzado el límite de generaciones. Vuelve en ~${mins} min.`,
        );
      } else {
        toast.error(
          `No pudimos generar el quiz: ${payload.detail ?? payload.error ?? "error_desconocido"}`,
        );
      }
      setSubmitting(false);
      return;
    }

    const { quiz_id, questions_count } = (await response.json()) as {
      quiz_id: string;
      questions_count: number;
    };

    toast.success(`Quiz listo: ${questions_count} preguntas.`);
    setOpen(false);
    setSubmitting(false);
    // Sprint 5 will route to /quiz/[id] for the player; for now go back to
    // /library and refresh so the new quiz shows up once the listing exists.
    router.push(`/library?quiz=${quiz_id}`);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !submitting && setOpen(next)}>
      <DialogTrigger render={trigger as React.ReactElement} />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Generar quiz</DialogTitle>
          <DialogDescription className="truncate">
            Desde &quot;{documentTitle}&quot;. La generación tarda entre 10 y 60
            segundos.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          <div className="space-y-2">
            <Label htmlFor="count">Número de preguntas</Label>
            <Input
              id="count"
              type="number"
              min={5}
              max={30}
              value={count}
              onChange={(event) => {
                const next = Number.parseInt(event.target.value, 10);
                if (Number.isFinite(next)) {
                  setCount(Math.max(5, Math.min(30, next)));
                }
              }}
              disabled={submitting}
            />
            <p className="text-xs text-muted-foreground">Entre 5 y 30.</p>
          </div>

          <div className="space-y-2">
            <Label>Dificultad</Label>
            <div className="space-y-2">
              {DIFFICULTY_OPTIONS.map((option) => {
                const isActive = difficulty === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setDifficulty(option.value)}
                    disabled={submitting}
                    className={cn(
                      "w-full rounded-lg border p-3 text-left transition-colors",
                      isActive
                        ? "border-primary bg-primary/10"
                        : "border-border hover:border-primary/40 hover:bg-card/60",
                    )}
                  >
                    <div className="text-sm font-medium">{option.label}</div>
                    <div className="text-xs text-muted-foreground">
                      {option.description}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
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
