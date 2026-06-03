import { Brain, FileText, Sparkles, Upload } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { createSupabaseServerClient } from "@/lib/supabase/server";

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
      "Extrae los conceptos clave y arma preguntas de distintos niveles de Bloom.",
  },
  {
    icon: Brain,
    title: "Estudia con calma",
    description:
      "Quiz cronometrado o libre, con explicación detallada en cada respuesta y tutor socrático.",
  },
];

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ code?: string; token_hash?: string; type?: string }>;
}) {
  // Defense in depth: if Supabase's allowlist falls back to the Site URL
  // ("/"), the OAuth callback lands here with `?code=...` instead of at
  // /auth/callback. Forward to the real handler so the exchange runs and
  // the user ends up on /library, not the marketing landing.
  const { code, token_hash, type } = await searchParams;
  if (code) {
    redirect(`/auth/callback?code=${encodeURIComponent(code)}&next=/library`);
  }
  if (token_hash && type) {
    redirect(
      `/auth/callback?token_hash=${encodeURIComponent(token_hash)}&type=${encodeURIComponent(type)}&next=/library`,
    );
  }

  // Server-side auth check: if logged in, CTAs go straight to /library.
  // If anonymous, they go to /login with a redirect-back hint.
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const primaryHref = user ? "/upload" : "/login?next=/upload";
  const secondaryHref = user ? "/library" : "/pricing";

  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-border/60">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-5">
          <Link href="/" className="flex items-center gap-2">
            <span
              className="size-7 rounded-lg"
              aria-hidden
              style={{
                background:
                  "linear-gradient(135deg, var(--primary), var(--accent))",
              }}
            />
            <span className="text-lg font-semibold tracking-tight">Quizen</span>
          </Link>
          <nav className="flex items-center gap-3 text-sm">
            <Link
              href="/pricing"
              className="text-muted-foreground hover:text-foreground"
            >
              Precios
            </Link>
            {user ? (
              <Link
                href="/library"
                className={cn(buttonVariants({ size: "sm" }))}
              >
                Mi biblioteca
              </Link>
            ) : (
              <Link
                href="/login"
                className={cn(
                  buttonVariants({ size: "sm", variant: "outline" }),
                )}
              >
                Iniciar sesión
              </Link>
            )}
          </nav>
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
            <Link
              href={primaryHref}
              className={cn(buttonVariants({ size: "lg" }))}
            >
              <Upload />
              {user ? "Subir un PDF" : "Empezar gratis"}
            </Link>
            <Link
              href={secondaryHref}
              className={cn(buttonVariants({ size: "lg", variant: "outline" }))}
            >
              {user ? "Ir a biblioteca" : "Ver planes"}
            </Link>
          </div>
          <p className="text-xs text-muted-foreground">
            Plan Free: 3 PDFs al mes. Sin tarjeta de crédito.
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
          <Link href="/pricing" className="hover:text-foreground">
            Planes y precios
          </Link>
        </div>
      </footer>
    </div>
  );
}
