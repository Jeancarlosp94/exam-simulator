"use client";

import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Filter = "all" | "correct" | "incorrect";

const OPTIONS: ReadonlyArray<{ value: Filter; label: string }> = [
  { value: "all", label: "Todas" },
  { value: "correct", label: "Correctas" },
  { value: "incorrect", label: "Incorrectas" },
];

type Props = {
  quizId: string;
  current: Filter;
};

/**
 * Filter buttons for the results revisión detallada. Re-renders the page
 * with ?filter= via plain links so the filter state lives in the URL
 * and survives refresh + share — no client state needed.
 */
export function ResultsFilter({ quizId, current }: Props) {
  return (
    <div className="flex gap-2">
      {OPTIONS.map((opt) => (
        <Link
          key={opt.value}
          href={`/quiz/${quizId}/results?filter=${opt.value}`}
          className={cn(
            buttonVariants({
              size: "sm",
              variant: current === opt.value ? "default" : "outline",
            }),
          )}
        >
          {opt.label}
        </Link>
      ))}
    </div>
  );
}
