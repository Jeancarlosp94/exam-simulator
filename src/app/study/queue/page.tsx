import { CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { buttonVariants } from "@/components/ui/button";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseServiceClient } from "@/lib/supabase/service";

import { StudyPlayer } from "../[document_id]/study-player";

/**
 * Cross-document flashcard review queue. Pulls SRS cards of type
 * "flashcard" that are due (next_review_at <= now), joins each to its
 * flashcard payload, and hands the list to the same StudyPlayer used at
 * /study/[document_id].
 */
export default async function StudyQueuePage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login?next=/study/queue");
  }

  const service = getSupabaseServiceClient();
  const { data: dueCards } = await service
    .from("srs_cards")
    .select("id, flashcard_id, source_type")
    .eq("user_id", user.id)
    .eq("source_type", "flashcard")
    .lte("next_review_at", new Date().toISOString())
    .order("next_review_at", { ascending: true })
    .limit(50);

  const flashcardIds = (dueCards ?? [])
    .map((c) => c.flashcard_id)
    .filter((id): id is string => id !== null);

  if (flashcardIds.length === 0) {
    return (
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center gap-4 px-6 py-12 text-center">
        <div className="flex size-16 items-center justify-center rounded-full bg-primary/10 text-primary">
          <CheckCircle2 className="size-8" />
        </div>
        <h1 className="text-2xl font-semibold">No hay tarjetas pendientes</h1>
        <p className="max-w-md text-muted-foreground">
          Volvé cuando algunas tarjetas estén listas para repasar, o generá
          tarjetas desde un documento en tu biblioteca.
        </p>
        <Link href="/library" className={buttonVariants()}>
          Ir a biblioteca
        </Link>
      </main>
    );
  }

  const { data: flashcards } = await service
    .from("flashcards")
    .select("id, front, back, bloom_level, document_id")
    .in("id", flashcardIds);

  const flashcardById = new Map((flashcards ?? []).map((f) => [f.id, f]));

  const cards = (dueCards ?? [])
    .map((c) => {
      if (!c.flashcard_id) return null;
      const f = flashcardById.get(c.flashcard_id);
      if (!f) return null;
      return {
        cardId: c.id,
        flashcardId: f.id,
        front: f.front,
        back: f.back,
        bloomLevel: f.bloom_level,
      };
    })
    .filter((c): c is NonNullable<typeof c> => c !== null);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-6 py-8">
      <header className="flex flex-col gap-1">
        <p className="text-xs text-muted-foreground">Repaso de tarjetas</p>
        <h1 className="text-2xl font-semibold tracking-tight">
          {cards.length} {cards.length === 1 ? "tarjeta" : "tarjetas"} en cola
        </h1>
      </header>

      <StudyPlayer documentTitle="Repaso mixto" cards={cards} />

      <footer className="flex justify-center">
        <Link href="/library" className={buttonVariants({ variant: "ghost" })}>
          Pausar y volver después
        </Link>
      </footer>
    </main>
  );
}
