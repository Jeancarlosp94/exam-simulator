import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { getSupabaseServiceClient } from "@/lib/supabase/service";
import type { QuestionOption } from "@/lib/supabase/types";

import { DemoPlayer } from "./demo-player";

type Params = { slug: string };

/**
 * Public quiz route. Anyone with the slug can take the quiz in demo mode.
 *
 * Reads use the service client (bypasses RLS) because:
 *  - public_quiz_shares.select is public anyway
 *  - questions are normally scoped to the quiz owner via RLS, but a share
 *    link IS a capability grant for the linked quiz — service client is
 *    the right level of trust here.
 */
async function loadShare(slug: string) {
  const service = getSupabaseServiceClient();

  const { data: share } = await service
    .from("public_quiz_shares")
    .select("slug, quiz_id, expires_at, view_count")
    .eq("slug", slug)
    .maybeSingle();
  if (!share) return null;

  if (
    share.expires_at !== null &&
    new Date(share.expires_at).getTime() < Date.now()
  ) {
    return null;
  }

  const { data: quiz } = await service
    .from("quizzes")
    .select("id, title, question_count, document_id")
    .eq("id", share.quiz_id)
    .single();
  if (!quiz) return null;

  // Per the prompt: document title is part of the OG description.
  const { data: document } = await service
    .from("documents")
    .select("title")
    .eq("id", quiz.document_id)
    .maybeSingle();

  const { data: questions } = await service
    .from("questions")
    .select("id, position, prompt, options, correct_label, explanation")
    .eq("quiz_id", quiz.id)
    .order("position", { ascending: true });

  return {
    share,
    quiz,
    documentTitle: document?.title ?? null,
    questions: (questions ?? []).map((q) => ({
      id: q.id,
      position: q.position,
      prompt: q.prompt,
      options: q.options as QuestionOption[],
      correct_label: q.correct_label,
      explanation: q.explanation,
    })),
  };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { slug } = await params;
  const data = await loadShare(slug);
  if (!data) {
    return { title: "Quiz no disponible — Quizen" };
  }
  const docPart = data.documentTitle ? ` sobre ${data.documentTitle}` : "";
  return {
    title: `Quiz: ${data.quiz.title} — Quizen`,
    description: `${data.quiz.question_count} preguntas${docPart}. Probalo gratis sin crear cuenta.`,
    openGraph: {
      title: `Quiz: ${data.quiz.title}`,
      description: `${data.quiz.question_count} preguntas${docPart}. Probalo en Quizen.`,
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: `Quiz: ${data.quiz.title}`,
      description: `${data.quiz.question_count} preguntas${docPart}. Probalo en Quizen.`,
    },
  };
}

export default async function PublicQuizPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { slug } = await params;
  const data = await loadShare(slug);
  if (!data) {
    notFound();
  }

  // Fire-and-forget view increment. We don't await it — visitors shouldn't
  // pay latency for analytics, and a missed increment is far cheaper than
  // a slow first-byte.
  void incrementViewCount(data.share.slug, data.share.view_count);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-6 py-12">
      <DemoPlayer quizTitle={data.quiz.title} questions={data.questions} />
    </main>
  );
}

async function incrementViewCount(slug: string, current: number) {
  try {
    const service = getSupabaseServiceClient();
    await service
      .from("public_quiz_shares")
      .update({ view_count: current + 1 })
      .eq("slug", slug);
  } catch {
    // Best-effort — skip telemetry-only errors.
  }
}
