import {
  AlertCircle,
  CheckCircle2,
  FileText,
  Loader2,
  Sparkles,
  Upload,
} from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { GenerateQuizDialog } from "@/components/quiz/generate-quiz-dialog";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { createSupabaseServerClient } from "@/lib/supabase/server";

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

export default async function LibraryPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: documents, error } = await supabase
    .from("documents")
    .select(
      "id, title, status, size_bytes, page_count, error_message, created_at",
    )
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`No se pudo cargar la biblioteca: ${error.message}`);
  }

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-6 py-12">
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

      {documents.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <div className="flex size-12 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <FileText className="size-6" />
            </div>
            <h2 className="text-lg font-medium">Tu biblioteca está vacía</h2>
            <p className="max-w-sm text-sm text-muted-foreground">
              Sube tu primer PDF para que Quizen genere cuestionarios sobre él.
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
            const isLoading = status === "uploading" || status === "extracting";
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
    </main>
  );
}
