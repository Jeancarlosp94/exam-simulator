"use client";

import { CheckCircle2, XCircle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import type {
  BloomLevel,
  Difficulty,
  QuestionOption,
} from "@/lib/supabase/types";

type ReviewCard = {
  cardId: string;
  easeFactor: number;
  intervalDays: number;
  repetitions: number;
  question: {
    id: string;
    prompt: string;
    options: QuestionOption[];
    correctLabel: string;
    explanation: string;
    bloomLevel: BloomLevel;
    difficulty: Difficulty;
  };
};

type Phase = "answering" | "feedback" | "submitting";

const difficultyLabel: Record<Difficulty, string> = {
  easy: "Fácil",
  medium: "Media",
  hard: "Difícil",
};

export function ReviewPlayer({ cards }: { cards: ReviewCard[] }) {
  const [index, setIndex] = useState(0);
  const [selectedLabel, setSelectedLabel] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>("answering");
  const [results, setResults] = useState<{ correct: number; wrong: number }>({
    correct: 0,
    wrong: 0,
  });

  const card = cards[index];

  if (!card) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
          <CheckCircle2 className="size-10 text-primary" />
          <h2 className="text-xl font-semibold">¡Repaso completado!</h2>
          <p className="text-muted-foreground">
            Acertaste {results.correct} de {results.correct + results.wrong}.
          </p>
        </CardContent>
      </Card>
    );
  }

  const isCorrect = selectedLabel === card.question.correctLabel;

  async function handleReveal() {
    if (!selectedLabel) {
      toast.error("Elige una opción primero.");
      return;
    }
    setPhase("feedback");
    setResults((prev) =>
      isCorrect
        ? { ...prev, correct: prev.correct + 1 }
        : { ...prev, wrong: prev.wrong + 1 },
    );
  }

  async function handleNext() {
    if (!card) return;
    setPhase("submitting");
    const response = await fetch("/api/review/answer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        card_id: card.cardId,
        is_correct: isCorrect,
      }),
    });
    if (!response.ok) {
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
      };
      toast.error(
        `No se pudo actualizar el repaso: ${payload.error ?? "error"}`,
      );
      setPhase("feedback");
      return;
    }
    setIndex((i) => i + 1);
    setSelectedLabel(null);
    setPhase("answering");
  }

  const total = cards.length;
  const progress = ((index + (phase === "feedback" ? 0.5 : 0)) / total) * 100;

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <Progress value={progress} />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>
            {index + 1} de {total}
          </span>
          <span>
            ✓ {results.correct} · ✗ {results.wrong}
          </span>
        </div>
      </div>

      <Card>
        <CardContent className="space-y-5 p-6">
          <div className="flex flex-wrap gap-2 text-xs">
            <Badge variant="outline" className="border-border bg-card/40">
              {difficultyLabel[card.question.difficulty]}
            </Badge>
            <Badge variant="outline" className="border-border bg-card/40">
              Rep. {card.repetitions} · Ease {card.easeFactor.toFixed(2)}
            </Badge>
          </div>

          <p className="text-base leading-relaxed">{card.question.prompt}</p>

          <ul className="space-y-2">
            {card.question.options.map((option) => {
              const isSelected = selectedLabel === option.label;
              const isTheCorrect = option.label === card.question.correctLabel;
              const showFeedback = phase === "feedback";

              return (
                <li key={option.label}>
                  <button
                    type="button"
                    disabled={phase !== "answering"}
                    onClick={() => setSelectedLabel(option.label)}
                    className={cn(
                      "flex w-full items-start gap-3 rounded-lg border p-3 text-left text-sm transition-all",
                      showFeedback &&
                        isTheCorrect &&
                        "border-primary bg-primary/10",
                      showFeedback &&
                        isSelected &&
                        !isTheCorrect &&
                        "border-destructive bg-destructive/10",
                      !showFeedback &&
                        isSelected &&
                        "border-primary bg-primary/10 shadow-sm",
                      !showFeedback &&
                        !isSelected &&
                        "border-border hover:border-primary/40 hover:bg-card/60",
                      showFeedback &&
                        !isSelected &&
                        !isTheCorrect &&
                        "border-border bg-card/40 opacity-70",
                    )}
                  >
                    <span
                      className={cn(
                        "flex size-7 shrink-0 items-center justify-center rounded-full border text-sm font-semibold",
                        showFeedback &&
                          isTheCorrect &&
                          "border-primary bg-primary text-primary-foreground",
                        showFeedback &&
                          isSelected &&
                          !isTheCorrect &&
                          "border-destructive bg-destructive text-destructive-foreground",
                        !showFeedback &&
                          isSelected &&
                          "border-primary bg-primary text-primary-foreground",
                        !showFeedback &&
                          !isSelected &&
                          "border-border text-muted-foreground",
                      )}
                    >
                      {option.label}
                    </span>
                    <span className="leading-snug">{option.text}</span>
                  </button>
                </li>
              );
            })}
          </ul>

          {phase === "feedback" && (
            <div
              className={cn(
                "rounded-lg border p-4",
                isCorrect
                  ? "border-primary/30 bg-primary/5"
                  : "border-destructive/30 bg-destructive/5",
              )}
            >
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
                {isCorrect ? (
                  <>
                    <CheckCircle2 className="size-4 text-primary" />
                    <span className="text-primary">Correcto</span>
                  </>
                ) : (
                  <>
                    <XCircle className="size-4 text-destructive" />
                    <span className="text-destructive">Incorrecto</span>
                  </>
                )}
              </div>
              <p className="text-sm leading-relaxed">
                {card.question.explanation}
              </p>
            </div>
          )}

          <div className="flex justify-end">
            {phase === "answering" && (
              <Button onClick={handleReveal} disabled={!selectedLabel}>
                Revisar
              </Button>
            )}
            {(phase === "feedback" || phase === "submitting") && (
              <Button onClick={handleNext} disabled={phase === "submitting"}>
                {phase === "submitting"
                  ? "Guardando..."
                  : index + 1 === total
                    ? "Terminar"
                    : "Siguiente →"}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
