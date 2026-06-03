import { NextResponse } from "next/server";
import { z } from "zod";

import { checkRateLimit } from "@/lib/rate-limit";
import {
  generateAdvanceOrganizer,
  generateConceptMapNodes,
  generateKeyTerms,
  StudyGuideGenerationError,
} from "@/lib/study/generator";
import { STUDY_MODES } from "@/lib/study/modes";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseServiceClient } from "@/lib/supabase/service";

/**
 * POST /api/study/start
 * Body: { document_id, mode }
 *
 * Creates a study session in 'pre_study' step. Generates the universal
 * pre-training content (key terms + advance organizer) in parallel. For
 * deep_work mode also generates the concept map nodes so they're ready
 * when the student gets to that step. Returns the session id.
 */
export const runtime = "nodejs";
export const maxDuration = 60;

const Body = z.object({
  document_id: z.string().uuid(),
  mode: z.enum(["pomodoro", "deep_work", "feynman", "quick_review"]),
});

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const rateLimit = await checkRateLimit(
    { prefix: "study-start", requests: 10, window: "1 h" },
    user.id,
  );
  if (!rateLimit.ok) {
    return NextResponse.json(
      {
        error: "rate_limited",
        retry_after_seconds: rateLimit.retryAfterSeconds,
      },
      {
        status: 429,
        headers: { "Retry-After": String(rateLimit.retryAfterSeconds) },
      },
    );
  }

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
  const { document_id, mode } = parsed.data;

  const modeConfig = STUDY_MODES[mode];

  const service = getSupabaseServiceClient();

  const { data: document } = await service
    .from("documents")
    .select("id, user_id, title, status")
    .eq("id", document_id)
    .single();
  if (!document) {
    return NextResponse.json({ error: "document_not_found" }, { status: 404 });
  }
  if (document.user_id !== user.id) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  if (document.status !== "ready") {
    return NextResponse.json(
      { error: "document_not_ready", status: document.status },
      { status: 409 },
    );
  }

  const { data: chunks } = await service
    .from("document_chunks")
    .select("content")
    .eq("document_id", document_id)
    .order("chunk_index", { ascending: true });
  if (!chunks || chunks.length === 0) {
    return NextResponse.json({ error: "no_chunks" }, { status: 500 });
  }

  const documentText = chunks.map((c) => c.content).join("\n\n");

  let keyTerms;
  let advanceOrganizer;
  let conceptMapNodes = null;
  try {
    // Parallel generation — independent calls.
    const tasks: Promise<unknown>[] = [
      generateKeyTerms(documentText).then((v) => (keyTerms = v)),
      generateAdvanceOrganizer(documentText).then(
        (v) => (advanceOrganizer = v),
      ),
    ];
    if (modeConfig.steps.conceptMap) {
      tasks.push(
        generateConceptMapNodes(documentText).then(
          (v) => (conceptMapNodes = v),
        ),
      );
    }
    await Promise.all(tasks);
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

  const { data: inserted, error: insertError } = await service
    .from("study_sessions")
    .insert({
      user_id: user.id,
      document_id,
      mode,
      key_terms: keyTerms ?? null,
      advance_organizer: advanceOrganizer ?? null,
      concept_map_nodes: conceptMapNodes,
    })
    .select("id")
    .single();
  if (insertError || !inserted) {
    return NextResponse.json(
      { error: "session_insert_failed", detail: insertError?.message },
      { status: 500 },
    );
  }

  return NextResponse.json({ session_id: inserted.id });
}
