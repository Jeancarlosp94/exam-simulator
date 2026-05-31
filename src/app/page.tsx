import { Brain, FileText, Sparkles, Upload } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const steps = [
  {
    icon: Upload,
    title: "Sube tu PDF",
    description:
      "Tus apuntes, un capítulo de libro, una guía de estudio. Cualquier PDF de texto.",
  },
  {
    icon: Sparkles,
    title: "La IA lo lee",
    description:
      "Claude extrae los conceptos clave y arma preguntas de distintos niveles de Bloom.",
  },
  {
    icon: Brain,
    title: "Estudia con calma",
    description:
      "Quiz cronometrado o libre, con explicación detallada en cada respuesta.",
  },
];

export default function Home() {
  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-border/60">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-5">
          <div className="flex items-center gap-2">
            <span
              className="size-7 rounded-lg bg-primary"
              aria-hidden
              style={{
                background:
                  "linear-gradient(135deg, var(--primary), var(--accent))",
              }}
            />
            <span className="text-lg font-semibold tracking-tight">Quizen</span>
          </div>
          <Badge
            variant="outline"
            className="border-primary/30 bg-primary/10 text-primary"
          >
            Beta privada · Sprint 1
          </Badge>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-6 py-20">
        <section className="flex flex-col items-center gap-8 text-center">
          <Badge
            variant="outline"
            className="rounded-full border-border/60 bg-card/40 text-xs uppercase tracking-widest text-muted-foreground"
          >
            <FileText className="mr-1 size-3" />
            PDF · IA · Cuestionarios
          </Badge>

          <h1 className="max-w-3xl text-5xl font-semibold tracking-tight sm:text-6xl">
            Sube tu PDF.{" "}
            <span className="text-primary">Estudia con calma.</span>
          </h1>

          <p className="max-w-2xl text-balance text-lg text-muted-foreground">
            Quizen toma cualquier documento y arma cuestionarios adaptados a tu
            material. Sin bancos de preguntas que mantener. Sin formatos raros.
            Solo tu PDF y la IA.
          </p>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Button size="lg" disabled className="cursor-not-allowed">
              <Upload />
              Subir un PDF
            </Button>
            <Button size="lg" variant="outline" disabled>
              Ver demo
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            La carga de PDF llega en el Sprint 3 (semana 4).
          </p>
        </section>

        <section className="mt-24 grid grid-cols-1 gap-6 sm:grid-cols-3">
          {steps.map(({ icon: Icon, title, description }) => (
            <article
              key={title}
              className="flex flex-col gap-3 rounded-2xl border border-border bg-card/40 p-6 transition-colors hover:border-primary/30 hover:bg-card/60"
            >
              <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Icon className="size-5" />
              </div>
              <h2 className="text-lg font-semibold text-card-foreground">
                {title}
              </h2>
              <p className="text-sm text-muted-foreground">{description}</p>
            </article>
          ))}
        </section>
      </main>

      <footer className="border-t border-border/60">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6 text-xs text-muted-foreground">
          <span>© 2026 Quizen</span>
          <span>Hecho con Claude · Next.js · Supabase</span>
        </div>
      </footer>
    </div>
  );
}
