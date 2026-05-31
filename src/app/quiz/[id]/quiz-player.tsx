"use client";

import { useRouter } from "next/navigation";
import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";

import { QuestionCard } from "@/components/quiz/question-card";
import {
  QuestionGrid,
  type QuestionStatus,
} from "@/components/quiz/question-grid";
import { Timer } from "@/components/quiz/timer";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useTimer } from "@/hooks/use-timer";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type {
  BloomLevel,
  Difficulty,
  QuestionOption,
} from "@/lib/supabase/types";

type PlayerQuestion = {
  id: string;
  position: number;
  prompt: string;
  options: QuestionOption[];
  bloomLevel: BloomLevel;
  difficulty: Difficulty;
};

type QuizPlayerProps = {
  quizId: string;
  quizTitle: string;
  attemptId: string;
  mode: "practice" | "timed";
  /** ISO timestamp when the attempt was created. Used to compute remaining time client-side. */
  attemptStartedAt: string;
  /** Quiz time limit in minutes. Null in practice mode. */
  timeLimitMinutes: number | null;
  questions: PlayerQuestion[];
  initialAnswers: Record<string, string | null>;
  initialFlags: Record<string, boolean>;
};

function computeInitialSeconds(
  attemptStartedAt: string,
  timeLimitMinutes: number | null,
): number {
  if (!timeLimitMinutes) return 0;
  const elapsedMs = Date.now() - new Date(attemptStartedAt).getTime();
  const totalMs = timeLimitMinutes * 60 * 1000;
  return Math.max(0, Math.floor((totalMs - elapsedMs) / 1000));
}

export function QuizPlayer({
  quizId,
  quizTitle,
  attemptId,
  mode,
  attemptStartedAt,
  timeLimitMinutes,
  questions,
  initialAnswers,
  initialFlags,
}: QuizPlayerProps) {
  const router = useRouter();

  // ── All hooks first; Rules of Hooks forbids them after any early return ──
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] =
    useState<Record<string, string | null>>(initialAnswers);
  const [flags, setFlags] = useState<Record<string, boolean>>(initialFlags);
  const [showConfirmSubmit, setShowConfirmSubmit] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Snapshot the time-left calculation on first render. Date.now() must not
  // run in RSCs (react-hooks/purity) so we compute it on the client mount.
  // useState initializer runs once — like the legacy useTimer pattern.
  const [initialSeconds] = useState(() =>
    computeInitialSeconds(attemptStartedAt, timeLimitMinutes),
  );

  // Prevent double-submit (timer firing concurrent with manual submit)
  const hasSubmittedRef = useRef(false);
  // Track in-flight answer upserts so submit can drain them first
  const pendingWrites = useRef(new Set<Promise<unknown>>());

  const handleFinalSubmit = useCallback(async () => {
    if (hasSubmittedRef.current) return;
    hasSubmittedRef.current = true;
    setSubmitting(true);

    if (pendingWrites.current.size > 0) {
      await Promise.allSettled(Array.from(pendingWrites.current));
    }

    const response = await fetch("/api/quiz/grade", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ attempt_id: attemptId }),
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        detail?: string;
      };
      toast.error(
        `No pudimos calificar el quiz: ${payload.detail ?? payload.error ?? "error_desconocido"}`,
      );
      hasSubmittedRef.current = false;
      setSubmitting(false);
      return;
    }

    router.push(`/quiz/${quizId}/results`);
  }, [attemptId, quizId, router]);

  const { timeLeft } = useTimer({
    initialSeconds,
    onFinish: () => {
      if (mode === "timed") {
        toast.info("Se acabó el tiempo. Calificando...");
        void handleFinalSubmit();
      }
    },
  });

  // ── Helpers (not hooks) ─────────────────────────────────────────────────

  const currentQuestion = questions[currentIndex];
  const answeredCount = Object.values(answers).filter(
    (a) => a !== null && a !== undefined,
  ).length;

  function persistAnswer(
    questionId: string,
    selectedLabel: string | null,
    flagged: boolean,
  ) {
    const supabase = createSupabaseBrowserClient();
    const promise: Promise<void> = (async () => {
      const { error } = await supabase.from("answers").upsert(
        {
          attempt_id: attemptId,
          question_id: questionId,
          selected_label: selectedLabel,
          flagged,
          answered_at: selectedLabel !== null ? new Date().toISOString() : null,
        },
        { onConflict: "attempt_id,question_id" },
      );
      if (error) {
        // Surface in console; don't block the user. The grade endpoint
        // sees what made it to the DB; missing answers count as unanswered.
        console.warn("answer_upsert_failed", error.message);
      }
    })();

    pendingWrites.current.add(promise);
    void promise.finally(() => pendingWrites.current.delete(promise));
  }

  function handleSelect(label: string) {
    if (!currentQuestion) return;
    setAnswers({ ...answers, [currentQuestion.id]: label });
    persistAnswer(
      currentQuestion.id,
      label,
      flags[currentQuestion.id] ?? false,
    );
  }

  function handleToggleFlag() {
    if (!currentQuestion) return;
    const nextFlag = !(flags[currentQuestion.id] ?? false);
    setFlags({ ...flags, [currentQuestion.id]: nextFlag });
    persistAnswer(
      currentQuestion.id,
      answers[currentQuestion.id] ?? null,
      nextFlag,
    );
  }

  function getQuestionStatus(index: number): QuestionStatus {
    const q = questions[index];
    if (!q) return "pending";
    if (answers[q.id] != null) return "answered";
    if (flags[q.id]) return "flagged";
    return "pending";
  }

  // ── Render: early-return for the impossible-state guard ──────────────────

  if (!currentQuestion) {
    return (
      <main className="flex flex-1 items-center justify-center p-6">
        <p className="text-muted-foreground">Pregunta no disponible.</p>
      </main>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-4 px-4 py-6 md:px-6">
      <header className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border bg-card/40 p-4">
        <div className="min-w-0">
          <h1 className="truncate text-lg font-semibold">{quizTitle}</h1>
          <p className="text-xs text-muted-foreground">
            {answeredCount} de {questions.length} respondidas
            {mode === "timed" ? " · Modo cronometrado" : " · Modo práctica"}
          </p>
        </div>
        {mode === "timed" && <Timer timeLeft={timeLeft} />}
        <Button
          onClick={() => setShowConfirmSubmit(true)}
          disabled={submitting}
        >
          Entregar
        </Button>
      </header>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_280px]">
        <QuestionCard
          questionNumber={currentIndex + 1}
          totalQuestions={questions.length}
          prompt={currentQuestion.prompt}
          options={currentQuestion.options}
          selectedLabel={answers[currentQuestion.id] ?? null}
          isFlagged={flags[currentQuestion.id] ?? false}
          bloomLevel={currentQuestion.bloomLevel}
          difficulty={currentQuestion.difficulty}
          onSelect={handleSelect}
          onToggleFlag={handleToggleFlag}
          onPrevious={() => setCurrentIndex((i) => Math.max(0, i - 1))}
          onNext={() =>
            setCurrentIndex((i) => Math.min(questions.length - 1, i + 1))
          }
          isFirst={currentIndex === 0}
          isLast={currentIndex === questions.length - 1}
        />

        <aside className="hidden lg:block">
          <QuestionGrid
            totalQuestions={questions.length}
            currentQuestion={currentIndex}
            getQuestionStatus={getQuestionStatus}
            onQuestionClick={setCurrentIndex}
          />
        </aside>
      </div>

      <Dialog open={showConfirmSubmit} onOpenChange={setShowConfirmSubmit}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>¿Entregar quiz?</DialogTitle>
            <DialogDescription>
              Has respondido {answeredCount} de {questions.length} preguntas.
              {answeredCount < questions.length && (
                <span className="mt-2 block text-amber-400">
                  Aún tienes preguntas sin responder. Una vez entregado, no
                  podrás cambiar tus respuestas.
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowConfirmSubmit(false)}
              disabled={submitting}
            >
              Cancelar
            </Button>
            <Button onClick={handleFinalSubmit} disabled={submitting}>
              {submitting ? "Calificando..." : "Entregar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
