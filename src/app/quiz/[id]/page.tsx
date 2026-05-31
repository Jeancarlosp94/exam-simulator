import { notFound, redirect } from "next/navigation";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseServiceClient } from "@/lib/supabase/service";

import { QuizPlayer } from "./quiz-player";

type Params = { id: string };

export default async function QuizPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { id: quizId } = await params;

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect(`/login?next=/quiz/${quizId}`);
  }

  // 1. Load the quiz (RLS scopes to current user automatically)
  const { data: quiz, error: quizError } = await supabase
    .from("quizzes")
    .select("id, user_id, title, question_count, time_limit_minutes")
    .eq("id", quizId)
    .single();
  if (quizError || !quiz) {
    notFound();
  }

  // 2. Load questions in stored order
  const { data: questions, error: questionsError } = await supabase
    .from("questions")
    .select(
      "id, position, prompt, options, correct_label, bloom_level, difficulty",
    )
    .eq("quiz_id", quizId)
    .order("position", { ascending: true });
  if (questionsError || !questions || questions.length === 0) {
    notFound();
  }

  // 3. Find an in-progress attempt for this user+quiz, or create one. We
  //    use the service client for the upsert so we can set started_at to
  //    a server timestamp atomically; RLS on attempts still scopes reads.
  const service = getSupabaseServiceClient();

  const { data: existingAttempt } = await service
    .from("attempts")
    .select("id, started_at, completed_at, mode")
    .eq("quiz_id", quizId)
    .eq("user_id", user.id)
    .is("completed_at", null)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let attemptId: string;
  let attemptStartedAt: string;
  let attemptMode: "practice" | "timed";

  if (existingAttempt) {
    attemptId = existingAttempt.id;
    attemptStartedAt = existingAttempt.started_at;
    attemptMode = existingAttempt.mode;
  } else {
    const mode: "practice" | "timed" = quiz.time_limit_minutes
      ? "timed"
      : "practice";
    const { data: newAttempt, error: insertError } = await service
      .from("attempts")
      .insert({ user_id: user.id, quiz_id: quizId, mode })
      .select("id, started_at, mode")
      .single();
    if (insertError || !newAttempt) {
      throw new Error(
        `No pudimos iniciar el intento: ${insertError?.message ?? "desconocido"}`,
      );
    }
    attemptId = newAttempt.id;
    attemptStartedAt = newAttempt.started_at;
    attemptMode = newAttempt.mode;
  }

  // 4. Load any prior answers for this attempt (resume support).
  const { data: priorAnswers } = await service
    .from("answers")
    .select("question_id, selected_label, flagged")
    .eq("attempt_id", attemptId);

  const initialAnswers: Record<string, string | null> = {};
  const initialFlags: Record<string, boolean> = {};
  for (const a of priorAnswers ?? []) {
    initialAnswers[a.question_id] = a.selected_label;
    if (a.flagged) initialFlags[a.question_id] = true;
  }

  // The client computes timeLeft from attemptStartedAt + timeLimitMinutes
  // (Next 16 + React 19 react-hooks/purity forbids Date.now() in RSCs).
  return (
    <QuizPlayer
      quizId={quiz.id}
      quizTitle={quiz.title}
      attemptId={attemptId}
      mode={attemptMode}
      attemptStartedAt={attemptStartedAt}
      timeLimitMinutes={quiz.time_limit_minutes}
      questions={questions.map((q) => ({
        id: q.id,
        position: q.position,
        prompt: q.prompt,
        options: q.options,
        bloomLevel: q.bloom_level,
        difficulty: q.difficulty,
      }))}
      initialAnswers={initialAnswers}
      initialFlags={initialFlags}
    />
  );
}
