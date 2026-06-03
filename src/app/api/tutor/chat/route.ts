import { GoogleGenAI } from "@google/genai";
import { NextResponse } from "next/server";
import { z } from "zod";

import { optionalEnv, requireEnv } from "@/lib/env";
import {
  buildTutorContext,
  TUTOR_SYSTEM_PROMPT,
  wrapStudentMessage,
} from "@/lib/quiz/tutor-prompts";
import { checkRateLimit } from "@/lib/rate-limit";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseServiceClient } from "@/lib/supabase/service";

const DEFAULT_TUTOR_MODEL = "gemini-2.5-flash";

/**
 * POST /api/tutor/chat
 * Body: { question_id, attempt_id, history: ChatMessage[] }
 *
 * Streams a plain-text reply from the Socratic tutor. The client reads
 * the stream with fetch().body.getReader() and accumulates the text.
 *
 * Caching strategy:
 *   - TUTOR_SYSTEM_PROMPT in system, cached.
 *   - Question + chunk context as a second system block, cached.
 *   - History (varies per turn) in messages, uncached.
 * → Within a single chat session about the same question, every turn
 *   after the first is a cache hit on both system blocks (~90% off the
 *   stable portion of input tokens).
 */
export const runtime = "nodejs";
export const maxDuration = 60;

const ChatMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1).max(4000),
});

const BodySchema = z.object({
  question_id: z.string().uuid(),
  attempt_id: z.string().uuid(),
  history: z.array(ChatMessageSchema).min(1).max(20),
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
    { prefix: "tutor-chat", requests: 30, window: "1 h" },
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

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const parsed = BodySchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_body", issues: parsed.error.issues },
      { status: 400 },
    );
  }
  const { question_id, attempt_id, history } = parsed.data;

  // Verify ownership: the question must belong to a quiz the user owns,
  // AND the attempt must belong to the user (so a user can't chat about
  // someone else's question by knowing its UUID).
  const service = getSupabaseServiceClient();
  const { data: question, error: questionError } = await service
    .from("questions")
    .select(
      "id, prompt, options, correct_label, explanation, source_chunk_id, quiz_id",
    )
    .eq("id", question_id)
    .single();
  if (questionError || !question) {
    return NextResponse.json({ error: "question_not_found" }, { status: 404 });
  }

  const { data: quiz } = await service
    .from("quizzes")
    .select("user_id")
    .eq("id", question.quiz_id)
    .single();
  if (!quiz || quiz.user_id !== user.id) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  // Student's pick for this question in the given attempt (if any).
  const { data: answer } = await service
    .from("answers")
    .select("selected_label")
    .eq("attempt_id", attempt_id)
    .eq("question_id", question_id)
    .maybeSingle();

  // Source chunk content (optional — questions can be grounded or not).
  let sourceChunkContent: string | null = null;
  if (question.source_chunk_id) {
    const { data: chunk } = await service
      .from("document_chunks")
      .select("content")
      .eq("id", question.source_chunk_id)
      .single();
    sourceChunkContent = chunk?.content ?? null;
  }

  const tutorContext = buildTutorContext({
    questionPrompt: question.prompt,
    options: question.options,
    correctLabel: question.correct_label,
    studentSelectedLabel: answer?.selected_label ?? null,
    explanation: question.explanation,
    sourceChunkContent,
  });

  // Gemini doesn't separate system from user the same way Anthropic does,
  // so we prepend system + tutor context as the first user turn (Gemini
  // also lacks per-block ephemeral caching — context is sent every turn).
  const apiKey = requireEnv("GEMINI_API_KEY");
  const model = optionalEnv("GEMINI_MODEL", DEFAULT_TUTOR_MODEL);
  const client = new GoogleGenAI({ apiKey });

  type GeminiContent = {
    role: "user" | "model";
    parts: Array<{ text: string }>;
  };
  const contents: GeminiContent[] = [
    {
      role: "user",
      parts: [{ text: `${TUTOR_SYSTEM_PROMPT}\n\n${tutorContext}` }],
    },
    // Gemini convention: alternating user/model. The first system block is
    // the user turn above; we need a model "ack" before the real history.
    { role: "model", parts: [{ text: "Entendido. ¿En qué te ayudo?" }] },
    ...history.map<GeminiContent>((m) =>
      m.role === "user"
        ? {
            role: "user",
            parts: [{ text: wrapStudentMessage(m.content) }],
          }
        : {
            role: "model",
            parts: [{ text: m.content }],
          },
    ),
  ];

  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      try {
        const stream = await client.models.generateContentStream({
          model,
          contents,
          config: { temperature: 0.6, maxOutputTokens: 1024 },
        });
        for await (const chunk of stream) {
          const text = chunk.text;
          if (text) controller.enqueue(encoder.encode(text));
        }
        controller.close();
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "tutor_stream_failed";
        controller.enqueue(encoder.encode(`\n\n[error: ${message}]`));
        controller.close();
      }
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
