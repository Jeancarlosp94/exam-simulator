import { FileText, Sparkles } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { GenerateFlashcardsDialog } from "@/components/quiz/generate-flashcards-dialog";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseServiceClient } from "@/lib/supabase/service";

import { StudyPlayer } from "./study-player";

type Params = { document_id: string };

export default async function StudyPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { document_id } = await params;

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect(`/login?next=/study/${document_id}`);
  }

  const { data: document } = await supabase
    .from("documents")
    .select("id, title, status")
    .eq("id", document_id)
    .single();
  if (!document) {
    notFound();
  }

  const service = getSupabaseServiceClient();
  const { data: flashcards } = await service
    .from("flashcards")
    .select("id, front, back, bloom_level, created_at")
    .eq("user_id", user.id)
    .eq("document_id", document_id)
    .order("created_at", { ascending: true });

  // Pair each flashcard with its SRS card id so the player can rate.
  const flashcardIds = (flashcards ?? []).map((f) => f.id);
  const { data: srsRows } =
    flashcardIds.length === 0
      ? { data: [] as Array<{ id: string; flashcard_id: string | null }> }
      : await service
          .from("srs_cards")
          .select("id, flashcard_id")
          .eq("user_id", user.id)
          .eq("source_type", "flashcard")
          .in("flashcard_id", flashcardIds);

  const srsByFlashcard = new Map<string, string>();
  for (const row of srsRows ?? []) {
    if (row.flashcard_id) srsByFlashcard.set(row.flashcard_id, row.id);
  }

  const cards = (flashcards ?? []).map((f) => ({
    cardId: srsByFlashcard.get(f.id) ?? null,
    flashcardId: f.id,
    front: f.front,
    back: f.back,
    bloomLevel: f.bloom_level,
  }));

  // No cards yet → empty state with a generate CTA.
  if (cards.length === 0) {
    return (
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-6 py-12">
        <header className="flex flex-col gap-1">
          <p className="text-xs text-muted-foreground">{document.title}</p>
          <h1 className="text-3xl font-semibold tracking-tight">
            Modo estudio
          </h1>
        </header>

        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
            <div className="flex size-12 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <FileText className="size-6" />
            </div>
            <h2 className="text-lg font-medium">Sin tarjetas todavía</h2>
            <p className="max-w-md text-sm text-muted-foreground">
              Genera ~25 tarjetas de estudio desde este documento. Las cards
              entran a tu cola de repaso y vuelven cuando te toca refrescarlas.
            </p>
            {document.status === "ready" ? (
              <GenerateFlashcardsDialog
                documentId={document.id}
                documentTitle={document.title}
                trigger={
                  <Button>
                    <Sparkles />
                    Generar tarjetas
                  </Button>
                }
              />
            ) : (
              <p className="text-xs text-amber-400">
                El documento todavía no está listo (estado:{" "}
                <span className="capitalize">{document.status}</span>).
              </p>
            )}
            <Link
              href="/library"
              className={cn(buttonVariants({ variant: "ghost" }))}
            >
              Volver a biblioteca
            </Link>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-6 py-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <p className="text-xs text-muted-foreground">{document.title}</p>
          <h1 className="text-2xl font-semibold tracking-tight">
            Modo estudio · {cards.length}{" "}
            {cards.length === 1 ? "tarjeta" : "tarjetas"}
          </h1>
        </div>
        {document.status === "ready" && (
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="border-border bg-card/40">
              {cards.length} tarjetas
            </Badge>
            <GenerateFlashcardsDialog
              documentId={document.id}
              documentTitle={document.title}
              trigger={
                <Button size="sm" variant="outline">
                  <Sparkles />
                  Generar más
                </Button>
              }
            />
          </div>
        )}
      </header>

      <StudyPlayer documentTitle={document.title} cards={cards} />

      <footer className="flex justify-center">
        <Link href="/library" className={buttonVariants({ variant: "ghost" })}>
          Volver a biblioteca
        </Link>
      </footer>
    </main>
  );
}
