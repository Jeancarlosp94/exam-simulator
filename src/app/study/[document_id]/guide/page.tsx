import { ArrowRight, Clock } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { ModePicker } from "@/components/study/mode-picker";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseServiceClient } from "@/lib/supabase/service";
import { STUDY_MODES } from "@/lib/study/modes";

type Params = { document_id: string };

/**
 * Mode picker landing for guided study. Lists any active sessions on
 * this document (resume CTA) and shows the four-card picker that POSTs
 * to /api/study/start.
 */
export default async function StudyGuidePage({
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
    redirect(`/login?next=/study/${document_id}/guide`);
  }

  const { data: document } = await supabase
    .from("documents")
    .select("id, title, status")
    .eq("id", document_id)
    .single();
  if (!document) notFound();

  const service = getSupabaseServiceClient();
  const { data: activeSessions } = await service
    .from("study_sessions")
    .select("id, mode, current_step, last_active_at")
    .eq("user_id", user.id)
    .eq("document_id", document_id)
    .eq("status", "active")
    .order("last_active_at", { ascending: false })
    .limit(3);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-6 py-8">
      <header className="flex flex-col gap-1">
        <p className="text-xs text-muted-foreground">{document.title}</p>
        <h1 className="text-3xl font-semibold tracking-tight">
          Modo guía de estudio
        </h1>
        <p className="text-sm text-muted-foreground">
          Elegí cómo querés trabajar este documento. Cada modo combina una
          disciplina de tiempo con técnicas con evidencia científica.
        </p>
      </header>

      {activeSessions && activeSessions.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold text-muted-foreground">
            Sesiones activas
          </h2>
          <ul className="flex flex-col gap-2">
            {activeSessions.map((s) => {
              const mode = STUDY_MODES[s.mode];
              return (
                <li key={s.id}>
                  <Link
                    href={`/study/${document_id}/guide/${s.id}`}
                    className="flex items-center gap-3 rounded-lg border border-primary/30 bg-primary/5 p-3 transition-colors hover:bg-primary/10"
                  >
                    <span className="text-xl" aria-hidden>
                      {mode.emoji}
                    </span>
                    <div className="flex flex-1 flex-col">
                      <span className="text-sm font-medium">{mode.name}</span>
                      <span className="text-xs text-muted-foreground">
                        Continuar desde {currentStepLabel(s.current_step)}
                      </span>
                    </div>
                    <Badge
                      variant="outline"
                      className="border-primary/30 bg-primary/10 text-primary"
                    >
                      <Clock className="size-3" />
                      Activa
                    </Badge>
                    <ArrowRight className="size-4 text-muted-foreground" />
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {document.status !== "ready" ? (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-sm text-amber-400">
              El documento todavía no está listo (estado:{" "}
              <span className="capitalize">{document.status}</span>).
            </p>
          </CardContent>
        </Card>
      ) : (
        <ModePicker documentId={document_id} />
      )}

      <footer className="flex justify-center">
        <Link
          href={`/study/${document_id}`}
          className={cn(buttonVariants({ variant: "ghost" }))}
        >
          Volver a tarjetas
        </Link>
      </footer>
    </main>
  );
}

function currentStepLabel(step: string): string {
  switch (step) {
    case "pre_study":
      return "calentamiento";
    case "chunks":
      return "lectura activa";
    case "concept_map":
      return "mapa de conceptos";
    case "completed":
      return "completado";
    default:
      return step;
  }
}
