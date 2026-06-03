"use client";

import { ArrowRight, CheckCircle2, Sparkles, XCircle } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { QuestionOption } from "@/lib/supabase/types";

type DemoQuestion = {
  id: string;
  position: number;
  prompt: string;
  options: QuestionOption[];
  correct_label: string;
  explanation: string;
};

type Props = {
  quizTitle: string;
  questions: DemoQuestion[];
};

/**
 * Stripped-down quiz player for /q/<slug>. No auth, no answers persisted,
 * no SRS cards. Just question → answer → feedback → next → final score
 * with a signup CTA. Mirrors the look of the authenticated player so the
 * experience is familiar when a visitor converts.
 */
export function DemoPlayer({ quizTitle, questions }: Props) {
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const [finished, setFinished] = useState(false);

  const total = questions.length;
  const current = questions[index];
  const isLast = index === total - 1;

  const score = useMemo(() => {
    let correct = 0;
    for (const q of questions) {
      if (answers[q.id] === q.correct_label) correct++;
    }
    return correct;
  }, [answers, questions]);

  if (!current && !finished) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-muted-foreground">
          Este quiz no tiene preguntas.
        </CardContent>
      </Card>
    );
  }

  if (finished) {
    const percentage = total > 0 ? Math.round((score / total) * 100) : 0;
    return (
      <div className="flex flex-col gap-6">
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
            <p className="text-sm text-muted-foreground">{quizTitle}</p>
            <h1 className="text-3xl font-semibold tracking-tight">
              {percentage}% — {score}/{total} correctas
            </h1>
            <p className="max-w-md text-sm text-muted-foreground">
              Hiciste el quiz en modo demo. Para guardar tu progreso, repasar
              las que fallaste con espaciado óptimo y generar tus propios
              quizzes desde PDFs, creá una cuenta gratis.
            </p>
            <div className="flex flex-wrap justify-center gap-3 pt-2">
              <Link
                href="/login"
                className={cn(buttonVariants({ size: "lg" }))}
              >
                <Sparkles />
                Crea cuenta gratis
              </Link>
              <Button
                size="lg"
                variant="outline"
                onClick={() => {
                  setIndex(0);
                  setAnswers({});
                  setRevealed({});
                  setFinished(false);
                }}
              >
                Reintentar quiz
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const selectedLabel = answers[current!.id];
  const isRevealed = revealed[current!.id] === true;
  const isCorrect = selectedLabel === current!.correct_label;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-end justify-between">
        <div className="flex flex-col gap-1">
          <p className="text-xs text-muted-foreground">{quizTitle}</p>
          <h1 className="text-xl font-semibold">
            Pregunta {index + 1} de {total}
          </h1>
        </div>
        <span className="text-sm text-muted-foreground">{score} correctas</span>
      </header>

      <Card>
        <CardContent className="space-y-5 py-6">
          <p className="text-base">{current!.prompt}</p>

          <ul className="space-y-2">
            {current!.options.map((opt) => {
              const isUserChoice = selectedLabel === opt.label;
              const isCorrectOption = opt.label === current!.correct_label;
              return (
                <li key={opt.label}>
                  <button
                    type="button"
                    disabled={isRevealed}
                    onClick={() =>
                      setAnswers((prev) => ({
                        ...prev,
                        [current!.id]: opt.label,
                      }))
                    }
                    className={cn(
                      "flex w-full items-start gap-3 rounded-lg border p-3 text-left text-sm transition-colors",
                      !isRevealed && isUserChoice
                        ? "border-primary/50 bg-primary/10"
                        : "border-border bg-card/40 hover:border-primary/30",
                      isRevealed &&
                        isCorrectOption &&
                        "border-primary/40 bg-primary/10",
                      isRevealed &&
                        !isCorrectOption &&
                        isUserChoice &&
                        "border-destructive/40 bg-destructive/10",
                      isRevealed && "cursor-default",
                    )}
                  >
                    <span className="font-semibold">{opt.label}.</span>
                    <span className="flex-1">{opt.text}</span>
                    {isRevealed && isCorrectOption && (
                      <CheckCircle2 className="size-4 shrink-0 text-primary" />
                    )}
                    {isRevealed && !isCorrectOption && isUserChoice && (
                      <XCircle className="size-4 shrink-0 text-destructive" />
                    )}
                  </button>
                </li>
              );
            })}
          </ul>

          {isRevealed && current!.explanation && (
            <div
              className={cn(
                "rounded-lg border p-4",
                isCorrect
                  ? "border-primary/20 bg-primary/5"
                  : "border-destructive/20 bg-destructive/5",
              )}
            >
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide">
                Explicación
              </p>
              <p className="text-sm leading-relaxed">{current!.explanation}</p>
            </div>
          )}

          <div className="flex justify-end gap-3">
            {!isRevealed ? (
              <Button
                onClick={() =>
                  setRevealed((prev) => ({ ...prev, [current!.id]: true }))
                }
                disabled={!selectedLabel}
              >
                Comprobar
              </Button>
            ) : isLast ? (
              <Button onClick={() => setFinished(true)}>
                Ver resultado
                <ArrowRight />
              </Button>
            ) : (
              <Button onClick={() => setIndex(index + 1)}>
                Siguiente
                <ArrowRight />
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
