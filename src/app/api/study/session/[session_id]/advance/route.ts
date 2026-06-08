import { NextResponse } from "next/server";
import { z } from "zod";

import {
  generateChunkPrompts,
  gradeExplanation,
  StudyGuideGenerationError,
} from "@/lib/study/generator";
import { STUDY_MODES } from "@/lib/study/modes";
import { recordActivity } from "@/lib/streak";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseServiceClient } from "@/lib/supabase/service";
import type { ConceptMapEdge } from "@/lib/supabase/types";

/**
 * POST /api/study/session/[session_id]/advance
 *
 * Multi-purpose endpoint that drives the guided session forward. The
 * `action` discriminator picks what to do:
 *
 *   - finish_pre_study: store the schema-activation answer and move to
 *     'chunks' step.
 *   - prepare_chunk: returns AI-generated prompts for chunk N (caches in DB).
 *   - submit_chunk: stores student responses, optionally invokes the
 *     self-explanation grader, returns the grade.
 *   - finish_chunks: marks current_step = 'concept_map' (if mode includes
 *     concept map) or 'completed' (otherwise).
 *   - submit_concept_map: stores edges and marks completed.
 *   - complete: terminal call when no concept map step.
 */
export const runtime = "nodejs";
export const maxDuration = 60;

const ChunkSubmitSchema = z.object({
  chunk_index: z.number().int().nonnegative(),
  elaborative_answer: z.string().max(2000).optional(),
  self_explanation_answer: z.string().max(2000).optional(),
  retrieval_selected_label: z.string().max(2).optional(),
});

const Body = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("finish_pre_study"),
    schema_activation_answer: z.string().max(2000).optional(),
  }),
  z.object({
    action: z.literal("prepare_chunk"),
    chunk_index: z.number().int().nonnegative(),
  }),
  z.object({ action: z.literal("submit_chunk") }).merge(ChunkSubmitSchema),
  z.object({ action: z.literal("finish_chunks") }),
  z.object({
    action: z.literal("submit_concept_map"),
    edges: z.array(
      z.object({ from: z.string(), to: z.string(), label: z.string().max(60) }),
    ),
  }),
  z.object({ action: z.literal("complete") }),
]);

export async function POST(
  request: Request,
  context: { params: Promise<{ session_id: string }> },
) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { session_id } = await context.params;

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const parsed = Body.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_body", issues: parsed.error.issues },
      { status: 400 },
    );
  }
  const body = parsed.data;

  const service = getSupabaseServiceClient();
  const { data: session } = await service
    .from("study_sessions")
    .select(
      "id, user_id, document_id, mode, status, current_step, current_chunk_index",
    )
    .eq("id", session_id)
    .single();
  if (!session) {
    return NextResponse.json({ error: "session_not_found" }, { status: 404 });
  }
  if (session.user_id !== user.id) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  if (session.status !== "active") {
    return NextResponse.json(
      { error: "session_not_active", status: session.status },
      { status: 409 },
    );
  }

  const modeConfig = STUDY_MODES[session.mode];
  const now = new Date().toISOString();

  // ── finish_pre_study ─────────────────────────────────────────────────
  if (body.action === "finish_pre_study") {
    // If the mode skips chunkLoop (quick_review), jump straight to
    // completion — the bridge to /quiz happens client-side.
    const nextStep = modeConfig.steps.chunkLoop ? "chunks" : "completed";
    await service
      .from("study_sessions")
      .update({
        current_step: nextStep,
        schema_activation_answer: body.schema_activation_answer ?? null,
        last_active_at: now,
        completed_at: nextStep === "completed" ? now : null,
        status: nextStep === "completed" ? "completed" : "active",
      })
      .eq("id", session_id);
    return NextResponse.json({ current_step: nextStep });
  }

  // ── prepare_chunk ────────────────────────────────────────────────────
  if (body.action === "prepare_chunk") {
    // Load the document chunk text to feed the AI.
    const { data: chunks } = await service
      .from("document_chunks")
      .select("id, chunk_index, content")
      .eq("document_id", session.document_id)
      .order("chunk_index", { ascending: true });
    if (!chunks || chunks.length === 0) {
      return NextResponse.json({ error: "no_chunks" }, { status: 500 });
    }
    const docChunk = chunks[body.chunk_index];
    if (!docChunk) {
      return NextResponse.json(
        { error: "chunk_index_out_of_range" },
        { status: 400 },
      );
    }

    // Reuse cached prompts on revisit.
    const { data: existing } = await service
      .from("study_session_chunks")
      .select(
        "elaborative_question, retrieval_question, elaborative_answer, self_explanation_answer, retrieval_selected_label, retrieval_is_correct, self_explanation_score, self_explanation_feedback",
      )
      .eq("session_id", session_id)
      .eq("chunk_index", body.chunk_index)
      .maybeSingle();

    let elaborativeQ = existing?.elaborative_question ?? null;
    let retrievalQ = existing?.retrieval_question ?? null;

    const needs = {
      elaborativeInterrogation:
        modeConfig.steps.elaborativeInterrogation && !elaborativeQ,
      retrievalCheck: modeConfig.steps.retrievalCheck && !retrievalQ,
    };

    if (needs.elaborativeInterrogation || needs.retrievalCheck) {
      try {
        const generated = await generateChunkPrompts(docChunk.content, needs);
        if (generated.elaborative_question)
          elaborativeQ = generated.elaborative_question;
        if (generated.retrieval_question)
          retrievalQ = generated.retrieval_question;
      } catch (err) {
        const detail =
          err instanceof StudyGuideGenerationError
            ? err.message
            : err instanceof Error
              ? err.message
              : "unknown_error";
        return NextResponse.json(
          { error: "ai_generation_failed", detail },
          { status: 502 },
        );
      }

      await service.from("study_session_chunks").upsert(
        {
          session_id,
          chunk_index: body.chunk_index,
          document_chunk_id: docChunk.id,
          elaborative_question: elaborativeQ,
          retrieval_question: retrievalQ,
        },
        { onConflict: "session_id,chunk_index" },
      );
    } else if (!existing) {
      // Seed a row so subsequent submit_chunk has something to update.
      await service.from("study_session_chunks").insert({
        session_id,
        chunk_index: body.chunk_index,
        document_chunk_id: docChunk.id,
      });
    }

    return NextResponse.json({
      chunk_text: docChunk.content,
      total_chunks: chunks.length,
      elaborative_question: elaborativeQ,
      retrieval_question: retrievalQ,
      // Echo back any prior responses so the UI can resume mid-chunk.
      prior: existing
        ? {
            elaborative_answer: existing.elaborative_answer,
            self_explanation_answer: existing.self_explanation_answer,
            self_explanation_score: existing.self_explanation_score,
            self_explanation_feedback: existing.self_explanation_feedback,
            retrieval_selected_label: existing.retrieval_selected_label,
            retrieval_is_correct: existing.retrieval_is_correct,
          }
        : null,
    });
  }

  // ── submit_chunk ─────────────────────────────────────────────────────
  if (body.action === "submit_chunk") {
    // Pull the cached retrieval_question to grade the MCQ.
    const { data: chunkRow } = await service
      .from("study_session_chunks")
      .select("document_chunk_id, retrieval_question, retrieval_attempts")
      .eq("session_id", session_id)
      .eq("chunk_index", body.chunk_index)
      .maybeSingle();
    if (!chunkRow) {
      return NextResponse.json(
        { error: "chunk_state_missing" },
        { status: 400 },
      );
    }

    // Grade MCQ.
    let retrievalIsCorrect: boolean | null = null;
    if (body.retrieval_selected_label && chunkRow.retrieval_question) {
      retrievalIsCorrect =
        body.retrieval_selected_label ===
        chunkRow.retrieval_question.correct_label;
    }

    // Grade self-explanation via LLM if requested.
    let selfExplanationScore: number | null = null;
    let selfExplanationFeedback: string | null = null;
    if (body.self_explanation_answer && modeConfig.steps.selfExplanation) {
      // Re-pull chunk content (cheap query) to grade against the source.
      const { data: docChunk } = await service
        .from("document_chunks")
        .select("content")
        .eq("id", chunkRow.document_chunk_id ?? "")
        .maybeSingle();
      if (docChunk) {
        try {
          const grade = await gradeExplanation(
            docChunk.content,
            body.self_explanation_answer,
          );
          selfExplanationScore = grade.score;
          selfExplanationFeedback = grade.feedback;
        } catch (err) {
          console.warn(
            "[study/advance] grader failed:",
            err instanceof Error ? err.message : err,
          );
        }
      }
    }

    await service
      .from("study_session_chunks")
      .update({
        elaborative_answer: body.elaborative_answer ?? null,
        self_explanation_answer: body.self_explanation_answer ?? null,
        self_explanation_score: selfExplanationScore,
        self_explanation_feedback: selfExplanationFeedback,
        retrieval_selected_label: body.retrieval_selected_label ?? null,
        retrieval_is_correct: retrievalIsCorrect,
        retrieval_attempts: chunkRow.retrieval_attempts + 1,
        completed_at: now,
      })
      .eq("session_id", session_id)
      .eq("chunk_index", body.chunk_index);

    await service
      .from("study_sessions")
      .update({
        current_chunk_index: body.chunk_index + 1,
        last_active_at: now,
      })
      .eq("id", session_id);

    // Daily activity for streak — fire-and-forget.
    void recordActivity(user.id, "study_chunk");

    return NextResponse.json({
      retrieval_is_correct: retrievalIsCorrect,
      self_explanation_score: selfExplanationScore,
      self_explanation_feedback: selfExplanationFeedback,
    });
  }

  // ── finish_chunks ────────────────────────────────────────────────────
  if (body.action === "finish_chunks") {
    const nextStep = modeConfig.steps.conceptMap ? "concept_map" : "completed";
    await service
      .from("study_sessions")
      .update({
        current_step: nextStep,
        last_active_at: now,
        completed_at: nextStep === "completed" ? now : null,
        status: nextStep === "completed" ? "completed" : "active",
      })
      .eq("id", session_id);
    return NextResponse.json({ current_step: nextStep });
  }

  // ── submit_concept_map ───────────────────────────────────────────────
  if (body.action === "submit_concept_map") {
    const edges: ConceptMapEdge[] = body.edges;
    await service
      .from("study_sessions")
      .update({
        concept_map_edges: edges,
        current_step: "completed",
        status: "completed",
        completed_at: now,
        last_active_at: now,
      })
      .eq("id", session_id);
    return NextResponse.json({ current_step: "completed" });
  }

  // ── complete (terminal nudge) ────────────────────────────────────────
  if (body.action === "complete") {
    await service
      .from("study_sessions")
      .update({
        current_step: "completed",
        status: "completed",
        completed_at: now,
        last_active_at: now,
      })
      .eq("id", session_id);
    return NextResponse.json({ current_step: "completed" });
  }

  return NextResponse.json({ error: "unknown_action" }, { status: 400 });
}
