"use client";

import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Lightbulb,
  Loader2,
  MessageSquareQuote,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { ConceptMapConstructor } from "@/components/study/concept-map-constructor";
import { TimerOverlay } from "@/components/study/timer-overlay";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { STUDY_MODES, type StudyMode } from "@/lib/study/modes";
import type {
  ConceptMapEdge,
  ConceptMapNode,
  KeyTerm,
  RetrievalQuestion,
} from "@/lib/supabase/types";

type Step = "pre_study" | "chunks" | "concept_map" | "completed";

type InitialState = {
  currentStep: Step;
  currentChunkIndex: number;
  keyTerms: KeyTerm[];
  advanceOrganizer: string;
  schemaActivationAnswer: string;
  conceptMapNodes: ConceptMapNode[];
  conceptMapEdges: ConceptMapEdge[];
  totalChunks: number;
};

type Props = {
  documentId: string;
  documentTitle: string;
  sessionId: string;
  mode: StudyMode;
  initialState: InitialState;
};

type ChunkData = {
  chunkText: string;
  totalChunks: number;
  elaborativeQuestion: string | null;
  retrievalQuestion: RetrievalQuestion | null;
};

/**
 * Orchestrates the guided session. The state machine matches what the
 * advance route understands. Each step's UI is inlined here so the
 * student sees consistent chrome across steps; the only sub-components
 * are the concept-map constructor and the timer overlay.
 */
export function GuidedSessionPlayer({
  documentId,
  documentTitle,
  sessionId,
  mode,
  initialState,
}: Props) {
  const config = STUDY_MODES[mode];

  const [step, setStep] = useState<Step>(initialState.currentStep);
  const [chunkIndex, setChunkIndex] = useState(initialState.currentChunkIndex);
  const [schemaAnswer, setSchemaAnswer] = useState(
    initialState.schemaActivationAnswer,
  );

  const [chunk, setChunk] = useState<ChunkData | null>(null);
  const [chunkLoading, setChunkLoading] = useState(false);
  const [elaborativeAnswer, setElaborativeAnswer] = useState("");
  const [selfExplanation, setSelfExplanation] = useState("");
  const [selectedLabel, setSelectedLabel] = useState<string | null>(null);
  const [explanationGrade, setExplanationGrade] = useState<{
    score: number;
    feedback: string;
  } | null>(null);
  const [retrievalRevealed, setRetrievalRevealed] = useState(false);
  const [retrievalCorrect, setRetrievalCorrect] = useState<boolean | null>(
    null,
  );
  const [submitting, setSubmitting] = useState(false);

  // Auto-load the current chunk when entering chunks step.
  useEffect(() => {
    if (step !== "chunks") return;
    if (chunk && chunk.totalChunks > 0) return;
    void prepareChunk(chunkIndex);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  async function callAdvance(body: object) {
    setSubmitting(true);
    try {
      const res = await fetch(`/api/study/session/${sessionId}/advance`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const payload = (await res.json().catch(() => ({}))) as {
          error?: string;
          detail?: string;
        };
        toast.error(payload.detail ?? payload.error ?? "error_desconocido");
        return null;
      }
      return await res.json();
    } finally {
      setSubmitting(false);
    }
  }

  async function prepareChunk(index: number) {
    setChunkLoading(true);
    setElaborativeAnswer("");
    setSelfExplanation("");
    setSelectedLabel(null);
    setExplanationGrade(null);
    setRetrievalRevealed(false);
    setRetrievalCorrect(null);
    try {
      const res = await fetch(`/api/study/session/${sessionId}/advance`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "prepare_chunk", chunk_index: index }),
      });
      if (!res.ok) {
        const payload = (await res.json().catch(() => ({}))) as {
          error?: string;
          detail?: string;
        };
        toast.error(
          payload.detail ?? payload.error ?? "No pudimos cargar el chunk.",
        );
        return;
      }
      const data = (await res.json()) as {
        chunk_text: string;
        total_chunks: number;
        elaborative_question: string | null;
        retrieval_question: RetrievalQuestion | null;
      };
      setChunk({
        chunkText: data.chunk_text,
        totalChunks: data.total_chunks,
        elaborativeQuestion: data.elaborative_question,
        retrievalQuestion: data.retrieval_question,
      });
    } finally {
      setChunkLoading(false);
    }
  }

  async function submitChunk() {
    if (!chunk) return;
    const body: {
      action: "submit_chunk";
      chunk_index: number;
      elaborative_answer?: string;
      self_explanation_answer?: string;
      retrieval_selected_label?: string;
    } = {
      action: "submit_chunk",
      chunk_index: chunkIndex,
    };
    if (config.steps.elaborativeInterrogation && elaborativeAnswer.trim()) {
      body.elaborative_answer = elaborativeAnswer.trim();
    }
    if (config.steps.selfExplanation && selfExplanation.trim()) {
      body.self_explanation_answer = selfExplanation.trim();
    }
    if (config.steps.retrievalCheck && selectedLabel) {
      body.retrieval_selected_label = selectedLabel;
    }

    const data = (await callAdvance(body)) as {
      retrieval_is_correct: boolean | null;
      self_explanation_score: number | null;
      self_explanation_feedback: string | null;
    } | null;
    if (!data) return;

    if (data.self_explanation_feedback !== null) {
      setExplanationGrade({
        score: data.self_explanation_score ?? 0,
        feedback: data.self_explanation_feedback,
      });
    }
    if (data.retrieval_is_correct !== null) {
      setRetrievalCorrect(data.retrieval_is_correct);
      setRetrievalRevealed(true);
    } else if (!config.steps.retrievalCheck) {
      // No MCQ in this mode — advance directly.
      advanceChunk();
    }
  }

  function advanceChunk() {
    if (!chunk) return;
    const next = chunkIndex + 1;
    if (next >= chunk.totalChunks) {
      void finishChunks();
    } else {
      setChunkIndex(next);
      setChunk(null);
      void prepareChunk(next);
    }
  }

  async function finishPreStudy() {
    const data = (await callAdvance({
      action: "finish_pre_study",
      schema_activation_answer: schemaAnswer.trim() || undefined,
    })) as { current_step: Step } | null;
    if (data) setStep(data.current_step);
  }

  async function finishChunks() {
    const data = (await callAdvance({ action: "finish_chunks" })) as {
      current_step: Step;
    } | null;
    if (data) setStep(data.current_step);
  }

  async function submitConceptMap(edges: ConceptMapEdge[]) {
    const data = (await callAdvance({
      action: "submit_concept_map",
      edges,
    })) as { current_step: Step } | null;
    if (data) setStep(data.current_step);
  }

  // Whole-session progress: pre_study 0–20%, chunks 20–80%, concept_map 80–95%, completed 100%.
  function overallProgress(): number {
    if (step === "pre_study") return 8;
    if (step === "chunks") {
      const total = chunk?.totalChunks ?? initialState.totalChunks ?? 1;
      const chunkProgress = total > 0 ? chunkIndex / total : 0;
      return 20 + chunkProgress * 60;
    }
    if (step === "concept_map") return 85;
    return 100;
  }

  return (
    <>
      <header className="flex flex-col gap-1">
        <p className="text-xs text-muted-foreground">
          {documentTitle} · {config.emoji} {config.name}
        </p>
        <Progress value={overallProgress()} />
      </header>

      {step === "pre_study" && (
        <PreStudyStep
          keyTerms={initialState.keyTerms}
          advanceOrganizer={initialState.advanceOrganizer}
          schemaAnswer={schemaAnswer}
          onSchemaAnswerChange={setSchemaAnswer}
          onContinue={finishPreStudy}
          submitting={submitting}
          buttonLabel={
            config.steps.chunkLoop
              ? "Empezar lectura activa"
              : "Listo, hacer el quiz"
          }
        />
      )}

      {step === "chunks" && (
        <ChunksStep
          chunk={chunk}
          chunkIndex={chunkIndex}
          chunkLoading={chunkLoading}
          config={config}
          elaborativeAnswer={elaborativeAnswer}
          onElaborativeAnswerChange={setElaborativeAnswer}
          selfExplanation={selfExplanation}
          onSelfExplanationChange={setSelfExplanation}
          selectedLabel={selectedLabel}
          onSelectedLabelChange={setSelectedLabel}
          retrievalRevealed={retrievalRevealed}
          retrievalCorrect={retrievalCorrect}
          explanationGrade={explanationGrade}
          onSubmitChunk={submitChunk}
          onContinueChunk={advanceChunk}
          submitting={submitting}
        />
      )}

      {step === "concept_map" && (
        <ConceptMapConstructor
          nodes={initialState.conceptMapNodes}
          initialEdges={initialState.conceptMapEdges}
          onSubmit={submitConceptMap}
          pending={submitting}
        />
      )}

      {step === "completed" && (
        <CompletedStep documentId={documentId} mode={mode} />
      )}

      {config.timer && step !== "completed" && (
        <TimerOverlay
          workMinutes={config.timer.workMinutes}
          breakMinutes={config.timer.breakMinutes}
        />
      )}
    </>
  );
}

// ────────────────────────────────────────────────────────────────────────
// Sub-step components (kept colocated since they're simple and only used
// here; pulling them out would just spread state-prop drilling)
// ────────────────────────────────────────────────────────────────────────

function PreStudyStep({
  keyTerms,
  advanceOrganizer,
  schemaAnswer,
  onSchemaAnswerChange,
  onContinue,
  submitting,
  buttonLabel,
}: {
  keyTerms: KeyTerm[];
  advanceOrganizer: string;
  schemaAnswer: string;
  onSchemaAnswerChange: (v: string) => void;
  onContinue: () => Promise<void>;
  submitting: boolean;
  buttonLabel: string;
}) {
  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardContent className="space-y-3 py-5">
          <div className="flex items-center gap-2">
            <BookOpen className="size-4 text-primary" />
            <h2 className="text-sm font-semibold uppercase tracking-wide text-primary">
              Orientación
            </h2>
          </div>
          <p className="text-base leading-relaxed">{advanceOrganizer}</p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-3 py-5">
          <h3 className="text-sm font-semibold">Conceptos clave</h3>
          <p className="text-xs text-muted-foreground">
            Antes de leer, familiarizate con estos términos. Activar vocabulario
            clave de antemano mejora la comprensión (Mayer, d≈0.85).
          </p>
          <ul className="flex flex-col gap-3">
            {keyTerms.map((kt) => (
              <li
                key={kt.term}
                className="rounded-lg border border-border bg-card/40 p-3"
              >
                <div className="text-sm font-semibold">{kt.term}</div>
                <p className="mt-1 text-sm">{kt.definition}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  <Lightbulb className="mr-1 inline size-3" />
                  {kt.why_it_matters}
                </p>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-3 py-5">
          <h3 className="text-sm font-semibold">
            ¿Qué ya sabés sobre este tema?
          </h3>
          <p className="text-xs text-muted-foreground">
            Escribí 2-3 ideas, aunque sean vagas. Activar conocimiento previo
            engancha mejor lo nuevo a lo que ya tenés.
          </p>
          <textarea
            value={schemaAnswer}
            onChange={(e) => onSchemaAnswerChange(e.target.value)}
            placeholder="Lo que recuerdo o creo saber..."
            maxLength={2000}
            className="min-h-[100px] w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm"
            disabled={submitting}
          />
          <div className="flex justify-end">
            <Button onClick={() => void onContinue()} disabled={submitting}>
              {submitting ? (
                <Loader2 className="animate-spin" />
              ) : (
                <ArrowRight />
              )}
              {buttonLabel}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function ChunksStep({
  chunk,
  chunkIndex,
  chunkLoading,
  config,
  elaborativeAnswer,
  onElaborativeAnswerChange,
  selfExplanation,
  onSelfExplanationChange,
  selectedLabel,
  onSelectedLabelChange,
  retrievalRevealed,
  retrievalCorrect,
  explanationGrade,
  onSubmitChunk,
  onContinueChunk,
  submitting,
}: {
  chunk: ChunkData | null;
  chunkIndex: number;
  chunkLoading: boolean;
  config: (typeof STUDY_MODES)[StudyMode];
  elaborativeAnswer: string;
  onElaborativeAnswerChange: (v: string) => void;
  selfExplanation: string;
  onSelfExplanationChange: (v: string) => void;
  selectedLabel: string | null;
  onSelectedLabelChange: (v: string) => void;
  retrievalRevealed: boolean;
  retrievalCorrect: boolean | null;
  explanationGrade: { score: number; feedback: string } | null;
  onSubmitChunk: () => Promise<void>;
  onContinueChunk: () => void;
  submitting: boolean;
}) {
  if (chunkLoading || !chunk) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
          <Loader2 className="size-6 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">
            Preparando preguntas didácticas...
          </p>
        </CardContent>
      </Card>
    );
  }

  const hasResponseFields =
    config.steps.elaborativeInterrogation ||
    config.steps.selfExplanation ||
    config.steps.retrievalCheck;

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardContent className="space-y-3 py-5">
          <Badge variant="outline" className="border-border bg-card/40">
            Sección {chunkIndex + 1} de {chunk.totalChunks}
          </Badge>
          <p className="whitespace-pre-line text-base leading-relaxed">
            {chunk.chunkText}
          </p>
        </CardContent>
      </Card>

      {config.steps.elaborativeInterrogation && chunk.elaborativeQuestion && (
        <Card>
          <CardContent className="space-y-3 py-5">
            <div className="flex items-center gap-2">
              <MessageSquareQuote className="size-4 text-primary" />
              <h3 className="text-sm font-semibold">Elaborar</h3>
            </div>
            <p className="text-sm">{chunk.elaborativeQuestion}</p>
            <textarea
              value={elaborativeAnswer}
              onChange={(e) => onElaborativeAnswerChange(e.target.value)}
              placeholder="Tu respuesta..."
              maxLength={2000}
              disabled={submitting || retrievalRevealed}
              className="min-h-[80px] w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </CardContent>
        </Card>
      )}

      {config.steps.selfExplanation && (
        <Card>
          <CardContent className="space-y-3 py-5">
            <h3 className="text-sm font-semibold">Explicale a un compañero</h3>
            <p className="text-xs text-muted-foreground">
              Sin volver al texto: ¿cómo le explicarías esto a alguien que no lo
              leyó? La IA te da feedback. Self-explanation tiene g≈0.55 (Bisra
              2018).
            </p>
            <textarea
              value={selfExplanation}
              onChange={(e) => onSelfExplanationChange(e.target.value)}
              placeholder="Tu explicación..."
              maxLength={2000}
              disabled={submitting || retrievalRevealed}
              className="min-h-[100px] w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
            {explanationGrade && (
              <div
                className={cn(
                  "rounded-lg border p-3 text-sm",
                  explanationGrade.score >= 4
                    ? "border-primary/30 bg-primary/5"
                    : explanationGrade.score >= 2
                      ? "border-amber-500/30 bg-amber-500/5"
                      : "border-destructive/30 bg-destructive/5",
                )}
              >
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide">
                  Feedback ({explanationGrade.score}/5)
                </p>
                <p className="leading-relaxed">{explanationGrade.feedback}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {config.steps.retrievalCheck && chunk.retrievalQuestion && (
        <Card>
          <CardContent className="space-y-3 py-5">
            <h3 className="text-sm font-semibold">Verificación rápida</h3>
            <p className="text-sm">{chunk.retrievalQuestion.prompt}</p>
            <ul className="space-y-2">
              {chunk.retrievalQuestion.options.map((opt) => {
                const isSelected = selectedLabel === opt.label;
                const isCorrectOpt =
                  opt.label === chunk.retrievalQuestion?.correct_label;
                return (
                  <li key={opt.label}>
                    <button
                      type="button"
                      disabled={submitting || retrievalRevealed}
                      onClick={() => onSelectedLabelChange(opt.label)}
                      className={cn(
                        "flex w-full items-start gap-3 rounded-lg border p-3 text-left text-sm transition-colors",
                        !retrievalRevealed && isSelected
                          ? "border-primary bg-primary/10"
                          : "border-border bg-card/40 hover:border-primary/30",
                        retrievalRevealed &&
                          isCorrectOpt &&
                          "border-primary bg-primary/10",
                        retrievalRevealed &&
                          isSelected &&
                          !isCorrectOpt &&
                          "border-destructive bg-destructive/10",
                      )}
                    >
                      <span className="font-semibold">{opt.label}.</span>
                      <span className="flex-1">{opt.text}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
            {retrievalRevealed && (
              <div
                className={cn(
                  "rounded-lg border p-3 text-sm",
                  retrievalCorrect
                    ? "border-primary/30 bg-primary/5"
                    : "border-destructive/30 bg-destructive/5",
                )}
              >
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide">
                  {retrievalCorrect ? "Correcto" : "Casi"}
                </p>
                <p className="leading-relaxed">
                  {chunk.retrievalQuestion.explanation}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <div className="flex justify-end gap-2">
        {!retrievalRevealed && hasResponseFields && (
          <Button
            onClick={() => void onSubmitChunk()}
            disabled={
              submitting ||
              (config.steps.retrievalCheck && !selectedLabel) ||
              (config.steps.selfExplanation && !selfExplanation.trim())
            }
          >
            {submitting ? <Loader2 className="animate-spin" /> : <ArrowRight />}
            Comprobar
          </Button>
        )}
        {retrievalRevealed && (
          <Button onClick={onContinueChunk}>
            <ArrowRight />
            {chunkIndex + 1 === chunk.totalChunks
              ? "Terminar lectura"
              : "Siguiente sección"}
          </Button>
        )}
        {!hasResponseFields && (
          <Button onClick={onContinueChunk}>
            <ArrowRight />
            Siguiente sección
          </Button>
        )}
      </div>
    </div>
  );
}

function CompletedStep({
  documentId,
  mode,
}: {
  documentId: string;
  mode: StudyMode;
}) {
  const config = STUDY_MODES[mode];
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
        <CheckCircle2 className="size-12 text-primary" />
        <h2 className="text-2xl font-semibold">¡Sesión completada!</h2>
        <p className="max-w-md text-sm text-muted-foreground">
          Terminaste el modo {config.name}. Ahora estás listo para evaluarte con
          un quiz o repasar con tarjetas — el cerebro fija mejor lo que
          recuperás activamente.
        </p>
        <div className="flex flex-wrap justify-center gap-3 pt-2">
          <Link
            href={`/library?document=${documentId}`}
            className={cn(buttonVariants(), "")}
          >
            <Sparkles />
            Hacer un quiz
          </Link>
          <Link
            href={`/study/${documentId}`}
            className={cn(buttonVariants({ variant: "outline" }))}
          >
            Tarjetas de repaso
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
