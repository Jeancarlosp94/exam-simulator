import {
  AlertCircle,
  Brain,
  CheckCircle2,
  Clock,
  FileText,
  Loader2,
  ListChecks,
  Play,
  Share2,
  Sparkles,
  Upload,
} from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { PortalButton } from "@/components/billing/portal-button";
import { GenerateQuizDialog } from "@/components/quiz/generate-quiz-dialog";
import { ShareDialog } from "@/components/quiz/share-dialog";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { countDocumentsThisMonth, getUserPlan } from "@/lib/billing/plan";
import { extensionLabel, extractExtension } from "@/lib/documents/extension";
import { cn } from "@/lib/utils";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseServiceClient } from "@/lib/supabase/service";

type SearchParams = { quiz?: string; upgraded?: string };

type DocumentStatus = "uploading" | "extracting" | "ready" | "failed";

const statusMeta: Record<
  DocumentStatus,
  {
    label: string;
    className: string;
    icon: React.ComponentType<{ className?: string }>;
  }
> = {
  uploading: {
    label: "Subiendo",
    className: "border-sky-500/30 bg-sky-500/10 text-sky-300",
    icon: Loader2,
  },
  extracting: {
    label: "Procesando",
    className: "border-amber-500/30 bg-amber-500/10 text-amber-300",
    icon: Loader2,
  },
  ready: {
    label: "Listo",
    className: "border-primary/30 bg-primary/10 text-primary",
    icon: CheckCircle2,
  },
  failed: {
    label: "Falló",
    className: "border-destructive/30 bg-destructive/10 text-destructive",
    icon: AlertCircle,
  },
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("es-EC", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default async function LibraryPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { quiz: highlightedQuizId, upgraded } = await searchParams;

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Documents, quizzes, due SRS cards, plan, and monthly usage in parallel.
  const service = getSupabaseServiceClient();
  const [
    { data: documents, error: docsError },
    { data: quizzes, error: quizzesError },
    { count: dueCount },
    plan,
    docsUsedThisMonth,
  ] = await Promise.all([
    supabase
      .from("documents")
      .select(
        "id, title, status, size_bytes, page_count, storage_path, error_message, created_at",
      )
      .order("created_at", { ascending: false }),
    supabase
      .from("quizzes")
      .select("id, title, difficulty, question_count, created_at, document_id")
      .order("created_at", { ascending: false }),
    service
      .from("srs_cards")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .lte("next_review_at", new Date().toISOString()),
    getUserPlan(user.id),
    countDocumentsThisMonth(user.id),
  ]);

  if (docsError) {
    throw new Error(`No se pudo cargar la biblioteca: ${docsError.message}`);
  }
  if (quizzesError) {
    throw new Error(
      `No se pudieron cargar los quizzes: ${quizzesError.message}`,
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-10 px-6 py-12">
      <header className="flex items-end justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-semibold tracking-tight">Biblioteca</h1>
          <p className="text-sm text-muted-foreground">
            Tus PDFs y los cuestionarios generados a partir de ellos.
          </p>
        </div>
        <Link href="/upload" className={buttonVariants()}>
          <Upload />
          Subir PDF
        </Link>
      </header>

      {/* ── Upgrade success banner (one-shot from Stripe success_url) ───── */}
      {upgraded === "1" && plan.plan === "pro" && (
        <Card className="border-primary/40 bg-primary/10">
          <CardContent className="flex items-center gap-3 py-4">
            <Sparkles className="size-5 text-primary" />
            <p className="text-sm">
              ¡Bienvenido a Quizen Pro! Tus límites se actualizaron.
            </p>
          </CardContent>
        </Card>
      )}

      {/* ── Plan + usage strip ─────────────────────────────────────────── */}
      <Card>
        <CardContent className="flex items-center justify-between gap-3 py-3">
          <div className="flex min-w-0 items-center gap-2">
            <Badge
              variant="outline"
              className={cn(
                plan.plan === "pro"
                  ? "border-primary/40 bg-primary/10 text-primary"
                  : "border-border bg-card/40",
              )}
            >
              {plan.plan === "pro" ? (
                <>
                  <Sparkles className="size-3" />
                  Pro
                </>
              ) : (
                "Free"
              )}
            </Badge>
            <p className="truncate text-xs text-muted-foreground sm:text-sm">
              {docsUsedThisMonth}/{plan.limits.documentsPerMonth} docs este mes
            </p>
          </div>
          {plan.plan === "free" ? (
            <Link
              href="/pricing"
              className={cn(buttonVariants({ size: "sm" }))}
            >
              <Sparkles />
              <span className="hidden sm:inline">Pasar a Pro</span>
              <span className="sm:hidden">Pro</span>
            </Link>
          ) : (
            <PortalButton size="sm" />
          )}
        </CardContent>
      </Card>

      {/* ── Repaso pendiente callout ───────────────────────────────────── */}
      {dueCount != null && dueCount > 0 && (
        <Card className="border-primary/40 bg-primary/5">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-lg bg-primary/15 text-primary">
                <Brain className="size-5" />
              </div>
              <div className="flex flex-col">
                <h2 className="text-sm font-medium">Repaso pendiente</h2>
                <p className="text-xs text-muted-foreground">
                  Tienes {dueCount} {dueCount === 1 ? "pregunta" : "preguntas"}{" "}
                  listas para repasar.
                </p>
              </div>
            </div>
            <Link href="/review" className={cn(buttonVariants({ size: "sm" }))}>
              Repasar ahora
            </Link>
          </CardContent>
        </Card>
      )}

      {/* ── Quizzes section ────────────────────────────────────────────── */}
      <section className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between">
          <h2 className="text-lg font-semibold">Quizzes</h2>
          <span className="text-xs text-muted-foreground">
            {quizzes?.length ?? 0} generados
          </span>
        </div>

        {!quizzes || quizzes.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-2 py-10 text-center">
              <ListChecks className="size-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Genera tu primer quiz desde un PDF listo abajo.
              </p>
            </CardContent>
          </Card>
        ) : (
          <ul className="grid grid-cols-1 gap-3">
            {quizzes.map((q) => {
              const isHighlighted = highlightedQuizId === q.id;
              return (
                <li key={q.id}>
                  <Card
                    className={cn(
                      "transition-colors hover:bg-card/70",
                      isHighlighted &&
                        "ring-2 ring-primary ring-offset-2 ring-offset-background",
                    )}
                  >
                    <CardContent className="flex flex-wrap items-center gap-3 py-5 sm:gap-4 sm:py-4">
                      <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <ListChecks className="size-5" />
                      </div>
                      <div className="flex min-w-0 flex-1 flex-col gap-1">
                        <h3 className="truncate font-medium text-card-foreground">
                          {q.title}
                        </h3>
                        <p className="truncate text-xs text-muted-foreground">
                          {formatDate(q.created_at)} · {q.question_count}{" "}
                          preguntas
                          <span className="ml-1 capitalize">
                            · {q.difficulty}
                          </span>
                        </p>
                      </div>
                      <div className="ml-auto flex w-full items-center gap-2 sm:w-auto">
                        <Link
                          href={`/quiz/${q.id}`}
                          className={cn(
                            buttonVariants({ size: "sm" }),
                            "flex-1 sm:flex-none",
                          )}
                        >
                          <Play />
                          Jugar
                        </Link>
                        <ShareDialog
                          quizId={q.id}
                          quizTitle={q.title}
                          trigger={
                            <Button
                              size="sm"
                              variant="outline"
                              title="Compartir link público"
                            >
                              <Share2 />
                            </Button>
                          }
                        />
                        <Link
                          href={`/quiz/${q.id}/results`}
                          className={cn(
                            buttonVariants({ size: "sm", variant: "outline" }),
                          )}
                          title="Ver últimos resultados (si los hay)"
                        >
                          <Clock />
                        </Link>
                      </div>
                    </CardContent>
                  </Card>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* ── Documents section ──────────────────────────────────────────── */}
      <section className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between">
          <h2 className="text-lg font-semibold">Documentos</h2>
          <span className="text-xs text-muted-foreground">
            {documents?.length ?? 0} cargados
          </span>
        </div>

        {!documents || documents.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
              <div className="flex size-12 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <FileText className="size-6" />
              </div>
              <h3 className="text-lg font-medium">Sin documentos</h3>
              <p className="max-w-sm text-sm text-muted-foreground">
                Sube tu primer PDF para que Quizen genere cuestionarios sobre
                él.
              </p>
              <Link href="/upload" className={cn(buttonVariants(), "mt-2")}>
                <Upload />
                Subir PDF
              </Link>
            </CardContent>
          </Card>
        ) : (
          <ul className="grid grid-cols-1 gap-3">
            {documents.map((doc) => {
              const status = doc.status as DocumentStatus;
              const meta = statusMeta[status];
              const Icon = meta.icon;
              const isLoading =
                status === "uploading" || status === "extracting";
              const ext = extractExtension(doc.storage_path);
              return (
                <li key={doc.id}>
                  <Card className="transition-colors hover:bg-card/70">
                    <CardContent className="flex items-center gap-4 py-4">
                      <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-secondary text-secondary-foreground">
                        <FileText className="size-5" />
                      </div>
                      <div className="flex flex-1 flex-col gap-1 overflow-hidden">
                        <h3 className="truncate font-medium text-card-foreground">
                          {doc.title}
                        </h3>
                        <p className="truncate text-xs text-muted-foreground">
                          {formatDate(doc.created_at)} ·{" "}
                          {formatBytes(doc.size_bytes)}
                          {doc.page_count ? ` · ${doc.page_count} págs` : ""}
                        </p>
                        {status === "failed" && doc.error_message && (
                          <p className="truncate text-xs text-destructive">
                            {doc.error_message}
                          </p>
                        )}
                      </div>
                      {status === "ready" && (
                        <GenerateQuizDialog
                          documentId={doc.id}
                          documentTitle={doc.title}
                          trigger={
                            <Button size="sm" variant="outline">
                              <Sparkles />
                              Generar quiz
                            </Button>
                          }
                        />
                      )}
                      <Badge
                        variant="outline"
                        className="border-border bg-card/40 text-muted-foreground"
                      >
                        {extensionLabel(ext)}
                      </Badge>
                      <Badge variant="outline" className={cn(meta.className)}>
                        <Icon
                          className={cn("size-3", isLoading && "animate-spin")}
                        />
                        {meta.label}
                      </Badge>
                    </CardContent>
                  </Card>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}
