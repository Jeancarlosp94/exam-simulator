"use client";

import { CheckCircle2, RotateCw } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";

import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import type { BloomLevel } from "@/lib/supabase/types";

type StudyCard = {
  cardId: string | null; // SRS card id; null if SRS row failed to seed
  flashcardId: string;
  front: string;
  back: string;
  bloomLevel: BloomLevel;
};

type Props = {
  documentTitle: string;
  cards: StudyCard[];
};

/**
 * Anki-style flashcard study player. Show front → flip to back → user
 * self-rates (Again/Hard/Good/Easy) → maps to SM-2 quality (1/3/4/5) →
 * POST to /api/review/answer updates the SRS schedule, then advance.
 *
 * Cards without an SRS row (the seed insert failed during generation)
 * still render, the rating call just no-ops with a console warn — better
 * UX than blocking the study session entirely.
 */
type Quality = 1 | 3 | 4 | 5;

const RATING_BUTTONS: Array<{
  quality: Quality;
  label: string;
  description: string;
  className: string;
}> = [
  {
    quality: 1,
    label: "Otra vez",
    description: "Olvidé",
    className: "border-destructive/40 hover:bg-destructive/10",
  },
  {
    quality: 3,
    label: "Difícil",
    description: "Con esfuerzo",
    className: "border-amber-500/40 hover:bg-amber-500/10",
  },
  {
    quality: 4,
    label: "Bien",
    description: "Recordé",
    className: "border-primary/40 hover:bg-primary/10",
  },
  {
    quality: 5,
    label: "Fácil",
    description: "Sin dudas",
    className: "border-emerald-500/40 hover:bg-emerald-500/10",
  },
];

export function StudyPlayer({ documentTitle, cards }: Props) {
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const current = cards[index];
  const isLast = index === cards.length - 1;

  if (!current) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
          <CheckCircle2 className="size-10 text-primary" />
          <h2 className="text-xl font-semibold">¡Tarjetas completadas!</h2>
          <p className="text-muted-foreground">
            Revisaste las {cards.length} tarjetas de este documento. La cola de
            repaso te las irá mostrando en los próximos días según cómo las
            calificaste.
          </p>
          <Link href="/review" className={cn(buttonVariants(), "mt-2")}>
            Ir al repaso
          </Link>
        </CardContent>
      </Card>
    );
  }

  async function handleRate(quality: Quality) {
    if (!current) return;
    setSubmitting(true);
    try {
      if (current.cardId) {
        const res = await fetch("/api/review/answer", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ card_id: current.cardId, quality }),
        });
        if (!res.ok) {
          const payload = (await res.json().catch(() => ({}))) as {
            error?: string;
          };
          toast.error(
            `No pudimos actualizar el repaso: ${payload.error ?? "error"}`,
          );
        }
      } else {
        console.warn("[study] skipping rate — no SRS card for this flashcard");
      }
      setFlipped(false);
      setIndex((i) => i + 1);
    } finally {
      setSubmitting(false);
    }
  }

  const progress = (index / cards.length) * 100;

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <Progress value={progress} />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>
            {index + 1} de {cards.length}
          </span>
          <span className="truncate">{documentTitle}</span>
        </div>
      </div>

      <Card>
        <CardContent className="space-y-5 py-8 sm:py-10">
          <p className="text-center text-xs uppercase tracking-wide text-muted-foreground">
            {flipped ? "Reverso" : "Frente"}
          </p>
          <div
            role="button"
            tabIndex={0}
            onClick={() => !flipped && setFlipped(true)}
            onKeyDown={(e) => {
              if (!flipped && (e.key === "Enter" || e.key === " ")) {
                e.preventDefault();
                setFlipped(true);
              }
            }}
            className={cn(
              "min-h-[140px] cursor-pointer rounded-xl border border-border bg-card/40 p-6 text-base leading-relaxed",
              flipped && "cursor-default",
            )}
          >
            <p className="text-center text-lg font-medium">
              {flipped ? current.back : current.front}
            </p>
          </div>

          {!flipped ? (
            <div className="flex justify-center">
              <Button onClick={() => setFlipped(true)}>
                <RotateCw />
                Voltear
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {RATING_BUTTONS.map((rating) => (
                <Button
                  key={rating.quality}
                  variant="outline"
                  disabled={submitting}
                  onClick={() => handleRate(rating.quality)}
                  className={cn(
                    "flex h-auto flex-col gap-0.5 py-3",
                    rating.className,
                  )}
                >
                  <span className="text-sm font-semibold">{rating.label}</span>
                  <span className="text-[10px] text-muted-foreground">
                    {rating.description}
                  </span>
                </Button>
              ))}
            </div>
          )}

          {isLast && flipped && (
            <p className="text-center text-xs text-muted-foreground">
              Última tarjeta de la sesión.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
