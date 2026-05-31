"use client";

import { Flag } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type {
  BloomLevel,
  Difficulty,
  QuestionOption,
} from "@/lib/supabase/types";

type QuestionCardProps = {
  questionNumber: number;
  totalQuestions: number;
  prompt: string;
  options: QuestionOption[];
  selectedLabel: string | null;
  isFlagged: boolean;
  bloomLevel: BloomLevel;
  difficulty: Difficulty;
  onSelect: (label: string) => void;
  onToggleFlag: () => void;
  onPrevious: () => void;
  onNext: () => void;
  isFirst: boolean;
  isLast: boolean;
};

const difficultyBadge: Record<Difficulty, string> = {
  easy: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
  medium: "border-amber-500/30 bg-amber-500/10 text-amber-300",
  hard: "border-rose-500/30 bg-rose-500/10 text-rose-300",
};

const difficultyLabel: Record<Difficulty, string> = {
  easy: "Fácil",
  medium: "Media",
  hard: "Difícil",
};

const bloomLabel: Record<BloomLevel, string> = {
  remember: "Recordar",
  understand: "Comprender",
  apply: "Aplicar",
  analyze: "Analizar",
  evaluate: "Evaluar",
  create: "Crear",
};

export function QuestionCard({
  questionNumber,
  totalQuestions,
  prompt,
  options,
  selectedLabel,
  isFlagged,
  bloomLevel,
  difficulty,
  onSelect,
  onToggleFlag,
  onPrevious,
  onNext,
  isFirst,
  isLast,
}: QuestionCardProps) {
  return (
    <Card>
      <CardContent className="space-y-6 p-6">
        <div className="flex flex-wrap items-start gap-3">
          <Badge
            variant="outline"
            className="border-primary/30 bg-primary/10 text-primary"
          >
            Pregunta {questionNumber} de {totalQuestions}
          </Badge>
          <Badge
            variant="outline"
            className={cn(difficultyBadge[difficulty])}
            title="Dificultad"
          >
            {difficultyLabel[difficulty]}
          </Badge>
          <Badge variant="outline" className="border-border bg-card/40">
            {bloomLabel[bloomLevel]}
          </Badge>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onToggleFlag}
            className={cn(
              "ml-auto",
              isFlagged && "text-amber-400 hover:text-amber-300",
            )}
            title={isFlagged ? "Desmarcar" : "Marcar para revisión"}
            aria-pressed={isFlagged}
          >
            <Flag className={cn(isFlagged && "fill-current")} />
          </Button>
        </div>

        <p className="text-lg leading-relaxed text-card-foreground">{prompt}</p>

        <ul className="space-y-2">
          {options.map((option) => {
            const isSelected = selectedLabel === option.label;
            return (
              <li key={option.label}>
                <button
                  type="button"
                  onClick={() => onSelect(option.label)}
                  className={cn(
                    "flex w-full items-start gap-3 rounded-lg border p-4 text-left transition-all",
                    isSelected
                      ? "border-primary bg-primary/10 shadow-sm"
                      : "border-border hover:border-primary/40 hover:bg-card/60",
                  )}
                  aria-pressed={isSelected}
                >
                  <span
                    className={cn(
                      "flex size-7 shrink-0 items-center justify-center rounded-full border text-sm font-semibold",
                      isSelected
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border text-muted-foreground",
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

        <div className="flex justify-between border-t border-border pt-4">
          <Button variant="outline" onClick={onPrevious} disabled={isFirst}>
            ← Anterior
          </Button>
          <Button onClick={onNext} disabled={isLast}>
            Siguiente →
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
