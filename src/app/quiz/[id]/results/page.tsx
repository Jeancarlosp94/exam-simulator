import { CheckCircle2, Clock, Sparkles, XCircle } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ResultsFilter } from "@/components/quiz/results-filter";
import { cn } from "@/lib/utils";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseServiceClient } from "@/lib/supabase/service";
import type { QuestionOption } from "@/lib/supabase/types";

type Params = { id: string };
type SearchParams = { filter?: "all" | "correct" | "incorrect" };

function formatDuration(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

export default async function QuizResultsPage({
  params,
  searchParams,
}: {
  params: Promise<Params>;
  searchParams: Promise<SearchParams>;
}) {
  const { id: quizId } = await params;
  const { filter = "all" } = await searchParams;

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect(`/login?next=/quiz/${quizId}/results`);
  }

  const { data: quiz, error: quizError } = await supabase
    .from("quizzes")
    .select("id, title, time_limit_minutes")
    .eq("id", quizId)
    .single();
  if (quizError || !quiz) {
    notFound();
  }

  // Most recent COMPLETED attempt for this quiz+user
  const service = getSupabaseServiceClient();
  const { data: attempt } = await service
    .from("attempts")
    .select(
      "id, score_correct, score_total, time_spent_seconds, completed_at, started_at",
    )
    .eq("quiz_id", quizId)
    .eq("user_id", user.id)
    .not("completed_at", "is", null)
    .order("completed_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!attempt) {
    return (
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-6 py-12 text-center">
        <h1 className="text-2xl font-semibold">Sin resultados</h1>
        <p className="text-muted-foreground">
          Aún no has completado este quiz. Termínalo para ver los resultados.
        </p>
        <div className="flex justify-center">
          <Link href={`/quiz/${quizId}`} className={buttonVariants()}>
            Volver al quiz
          </Link>
        </div>
      </main>
    );
  }

  const { data: questions } = await service
    .from("questions")
    .select(
      "id, position, prompt, options, correct_label, explanation, bloom_level, difficulty",
    )
    .eq("quiz_id", quizId)
    .order("position", { ascending: true });

  const { data: answers } = await service
    .from("answers")
    .select("question_id, selected_label, is_correct, flagged")
    .eq("attempt_id", attempt.id);

  const answerByQuestion = new Map<
    string,
    {
      selected_label: string | null;
      is_correct: boolean | null;
      flagged: boolean;
    }
  >();
  for (const a of answers ?? []) {
    answerByQuestion.set(a.question_id, {
      selected_label: a.selected_label,
      is_correct: a.is_correct,
      flagged: a.flagged,
    });
  }

  const scoreCorrect = attempt.score_correct ?? 0;
  const scoreTotal = attempt.score_total ?? questions?.length ?? 0;
  const incorrectCount = (answers ?? []).filter(
    (a) => a.selected_label != null && a.is_correct === false,
  ).length;
  const unansweredCount =
    scoreTotal - (answers ?? []).filter((a) => a.selected_label != null).length;
  const percentage =
    scoreTotal > 0 ? Math.round((scoreCorrect / scoreTotal) * 1000) / 10 : 0;

  const filteredQuestions = (questions ?? []).filter((q) => {
    const ans = answerByQuestion.get(q.id);
    if (filter === "correct") return ans?.is_correct === true;
    if (filter === "incorrect")
      return (
        ans != null && ans.selected_label != null && ans.is_correct === false
      );
    return true;
  });

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-6 py-12">
      <header className="flex flex-col gap-1">
        <p className="text-xs text-muted-foreground">{quiz.title}</p>
        <h1 className="text-3xl font-semibold tracking-tight">
          Resultados del quiz
        </h1>
      </header>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card>
          <CardContent className="flex flex-col gap-1 py-5">
            <span className="text-xs text-muted-foreground">Calificación</span>
            <span className="text-3xl font-semibold text-primary">
              {percentage}%
            </span>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex flex-col gap-1 py-5">
            <span className="text-xs text-muted-foreground">Correctas</span>
            <span className="text-3xl font-semibold">
              {scoreCorrect}/{scoreTotal}
            </span>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex flex-col gap-1 py-5">
            <span className="text-xs text-muted-foreground">Incorrectas</span>
            <span className="text-3xl font-semibold text-destructive">
              {incorrectCount}
            </span>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex flex-col gap-1 py-5">
            <span className="text-xs text-muted-foreground">Sin responder</span>
            <span className="text-3xl font-semibold text-muted-foreground">
              {unansweredCount}
            </span>
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-4 py-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="size-4" />
            Tiempo:{" "}
            <span className="font-medium text-foreground">
              {formatDuration(attempt.time_spent_seconds ?? 0)}
            </span>
            {quiz.time_limit_minutes && (
              <>
                {" "}
                · Límite:{" "}
                <span className="font-medium text-foreground">
                  {quiz.time_limit_minutes} min
                </span>
              </>
            )}
          </div>
          <div className="flex gap-2">
            <Link
              href={`/quiz/${quizId}`}
              className={cn(buttonVariants({ variant: "outline" }))}
            >
              <Sparkles />
              Repetir quiz
            </Link>
            <Link href="/library" className={cn(buttonVariants())}>
              Volver a biblioteca
            </Link>
          </div>
        </CardContent>
      </Card>

      <section className="flex flex-col gap-4">
        <div className="flex items-end justify-between">
          <h2 className="text-xl font-semibold">Revisión detallada</h2>
          <ResultsFilter quizId={quizId} current={filter} />
        </div>

        <ul className="flex flex-col gap-3">
          {filteredQuestions.map((q) => {
            const ans = answerByQuestion.get(q.id);
            const selectedLabel = ans?.selected_label ?? null;
            const isUnanswered = selectedLabel == null;
            const isCorrect = ans?.is_correct === true;
            const options = q.options as QuestionOption[];

            return (
              <li key={q.id}>
                <Card
                  className={cn(
                    "border-l-4",
                    isUnanswered
                      ? "border-l-muted-foreground/40"
                      : isCorrect
                        ? "border-l-primary"
                        : "border-l-destructive",
                  )}
                >
                  <CardContent className="space-y-4 py-5">
                    <div className="flex flex-wrap items-start gap-3">
                      <Badge
                        variant="outline"
                        className={cn(
                          isUnanswered
                            ? "border-muted-foreground/30 bg-muted/40 text-muted-foreground"
                            : isCorrect
                              ? "border-primary/30 bg-primary/10 text-primary"
                              : "border-destructive/30 bg-destructive/10 text-destructive",
                        )}
                      >
                        {isUnanswered ? (
                          "Sin responder"
                        ) : isCorrect ? (
                          <>
                            <CheckCircle2 className="size-3" />
                            Correcta
                          </>
                        ) : (
                          <>
                            <XCircle className="size-3" />
                            Incorrecta
                          </>
                        )}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        Pregunta {q.position + 1}
                      </span>
                    </div>

                    <p className="text-base">{q.prompt}</p>

                    <ul className="space-y-2">
                      {options.map((opt) => {
                        const isCorrectOption = opt.label === q.correct_label;
                        const isUserChoice = opt.label === selectedLabel;
                        return (
                          <li
                            key={opt.label}
                            className={cn(
                              "rounded-lg border p-3 text-sm",
                              isCorrectOption &&
                                "border-primary/40 bg-primary/5",
                              isUserChoice &&
                                !isCorrectOption &&
                                "border-destructive/40 bg-destructive/5",
                              !isCorrectOption &&
                                !isUserChoice &&
                                "border-border bg-card/40",
                            )}
                          >
                            <span className="mr-2 font-semibold">
                              {opt.label}.
                            </span>
                            {opt.text}
                          </li>
                        );
                      })}
                    </ul>

                    {q.explanation && (
                      <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
                        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-primary">
                          Explicación
                        </p>
                        <p className="text-sm leading-relaxed">
                          {q.explanation}
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </li>
            );
          })}
        </ul>
      </section>
    </main>
  );
}
