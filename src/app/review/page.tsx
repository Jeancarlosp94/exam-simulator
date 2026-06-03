import { CheckCircle2, Sparkles } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { buttonVariants } from "@/components/ui/button";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseServiceClient } from "@/lib/supabase/service";

import { ReviewPlayer } from "./review-player";

/**
 * /review — walk through SRS cards due now (or earlier).
 *
 * We use the service client because the join goes through three tables
 * (srs_cards → questions → quizzes) and RLS on questions only passes
 * through the parent quiz's user_id. Easier and faster to do the
 * ownership check up front here (eq("user_id", user.id) on srs_cards)
 * and use service for the rest.
 *
 * Cards are loaded oldest-due-first so the user clears the backlog
 * before today's fresh cards.
 */
export default async function ReviewPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login?next=/review");
  }

  const service = getSupabaseServiceClient();
  const { data: dueCards, error } = await service
    .from("srs_cards")
    .select(
      "id, question_id, ease_factor, interval_days, repetitions, next_review_at",
    )
    .eq("user_id", user.id)
    .lte("next_review_at", new Date().toISOString())
    .order("next_review_at", { ascending: true })
    .limit(50);

  if (error) {
    throw new Error(`No se pudo cargar la cola de repaso: ${error.message}`);
  }

  if (!dueCards || dueCards.length === 0) {
    return (
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center gap-4 px-6 py-12 text-center">
        <div className="flex size-16 items-center justify-center rounded-full bg-primary/10 text-primary">
          <CheckCircle2 className="size-8" />
        </div>
        <h1 className="text-2xl font-semibold">Nada pendiente</h1>
        <p className="max-w-md text-muted-foreground">
          No tienes preguntas para repasar ahora mismo. La cola se llena
          automáticamente con preguntas que respondiste mal o que ya están
          listas para refrescar.
        </p>
        <Link href="/library" className={buttonVariants()}>
          <Sparkles />
          Ir a biblioteca
        </Link>
      </main>
    );
  }

  // question_id is nullable since Sprint 12 (flashcard cards leave it
  // null); the page only handles question MCQs for now.
  const questionDueCards = dueCards.filter(
    (c): c is typeof c & { question_id: string } => c.question_id !== null,
  );

  const questionIds = questionDueCards.map((c) => c.question_id);
  const { data: questions } = await service
    .from("questions")
    .select(
      "id, quiz_id, prompt, options, correct_label, explanation, bloom_level, difficulty",
    )
    .in("id", questionIds);

  const questionById = new Map((questions ?? []).map((q) => [q.id, q]));

  const cards = questionDueCards
    .map((card) => {
      const q = questionById.get(card.question_id);
      if (!q) return null;
      return {
        cardId: card.id,
        easeFactor: card.ease_factor,
        intervalDays: card.interval_days,
        repetitions: card.repetitions,
        question: {
          id: q.id,
          prompt: q.prompt,
          options: q.options,
          correctLabel: q.correct_label,
          explanation: q.explanation,
          bloomLevel: q.bloom_level,
          difficulty: q.difficulty,
        },
      };
    })
    .filter((c): c is NonNullable<typeof c> => c !== null);

  if (cards.length === 0) {
    return (
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center gap-4 px-6 py-12 text-center">
        <h1 className="text-xl font-semibold">Cola inconsistente</h1>
        <p className="text-muted-foreground">
          Hay cards en tu cola pero las preguntas asociadas ya no existen. Esto
          puede pasar si borraste un quiz. La cola se limpiará sola al próximo
          repaso.
        </p>
        <Link href="/library" className={buttonVariants()}>
          Volver a biblioteca
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-6 py-8">
      <header className="flex flex-col gap-1">
        <p className="text-xs text-muted-foreground">Repaso espaciado</p>
        <h1 className="text-2xl font-semibold tracking-tight">
          {cards.length} {cards.length === 1 ? "card" : "cards"} para repasar
        </h1>
      </header>

      <ReviewPlayer cards={cards} />

      <footer className="flex justify-center">
        <Link href="/library" className={buttonVariants({ variant: "ghost" })}>
          Pausar y volver después
        </Link>
      </footer>
    </main>
  );
}
