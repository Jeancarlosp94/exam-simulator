import { Check, Sparkles } from "lucide-react";
import Link from "next/link";

import { PortalButton } from "@/components/billing/portal-button";
import { UpgradeButton } from "@/components/billing/upgrade-button";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PLAN_LIMITS, getUserPlan } from "@/lib/billing/plan";
import { cn } from "@/lib/utils";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type SearchParams = { canceled?: string };

const PRO_FEATURES = [
  `${PLAN_LIMITS.pro.documentsPerMonth} PDFs por mes`,
  `Hasta ${PLAN_LIMITS.pro.questionsPerQuiz} preguntas por quiz`,
  "Tutor socrático ilimitado",
  "Repaso espaciado automático",
  "Soporte por email",
];

const FREE_FEATURES = [
  `${PLAN_LIMITS.free.documentsPerMonth} PDFs por mes`,
  `Hasta ${PLAN_LIMITS.free.questionsPerQuiz} preguntas por quiz`,
  "Tutor con límite diario",
  "Repaso espaciado automático",
];

export default async function PricingPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { canceled } = await searchParams;

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const plan = user ? await getUserPlan(user.id) : null;

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-10 px-6 py-16">
      <header className="flex flex-col items-center gap-3 text-center">
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
          Estudia sin frenos.
        </h1>
        <p className="max-w-2xl text-balance text-muted-foreground">
          Quizen Free te deja probar el flujo completo. Pro elimina los límites
          de PDFs y preguntas para que estudies a tu ritmo real.
        </p>
        {canceled && (
          <p className="rounded-full border border-amber-500/30 bg-amber-500/10 px-4 py-1 text-xs text-amber-300">
            Cancelaste el checkout. Cuando quieras volver, aquí estamos.
          </p>
        )}
      </header>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card className="border-border/80">
          <CardContent className="flex flex-col gap-5 p-8">
            <div className="flex flex-col gap-1">
              <p className="text-xs uppercase tracking-widest text-muted-foreground">
                Free
              </p>
              <p className="flex items-baseline gap-2">
                <span className="text-4xl font-semibold">$0</span>
                <span className="text-sm text-muted-foreground">/mes</span>
              </p>
            </div>
            <ul className="flex flex-col gap-2 text-sm">
              {FREE_FEATURES.map((feature) => (
                <li key={feature} className="flex items-start gap-2">
                  <Check className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
            {!user ? (
              <Link
                href="/login"
                className={cn(buttonVariants({ variant: "outline" }))}
              >
                Crear cuenta
              </Link>
            ) : plan?.plan === "free" ? (
              <p className="text-xs text-muted-foreground">
                Estás en este plan ahora.
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Bajas a Free cuando cancelas Pro.
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="border-primary/40 shadow-lg shadow-primary/10">
          <CardContent className="flex flex-col gap-5 p-8">
            <div className="flex flex-col gap-1">
              <p className="flex items-center gap-2 text-xs uppercase tracking-widest text-primary">
                <Sparkles className="size-3" />
                Pro
              </p>
              <p className="flex items-baseline gap-2">
                <span className="text-4xl font-semibold">$9</span>
                <span className="text-sm text-muted-foreground">/mes</span>
              </p>
            </div>
            <ul className="flex flex-col gap-2 text-sm">
              {PRO_FEATURES.map((feature) => (
                <li key={feature} className="flex items-start gap-2">
                  <Check className="mt-0.5 size-4 shrink-0 text-primary" />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
            {!user ? (
              <Link
                href="/login?next=/pricing"
                className={cn(buttonVariants())}
              >
                <Sparkles />
                Iniciar sesión para suscribirte
              </Link>
            ) : plan?.plan === "pro" ? (
              <div className="flex flex-col gap-2">
                <p className="rounded-md border border-primary/30 bg-primary/5 p-3 text-xs">
                  Eres Pro
                  {plan.cancel_at_period_end && plan.current_period_end
                    ? ` (cancelación programada para ${new Date(plan.current_period_end).toLocaleDateString("es-EC")})`
                    : "."}
                </p>
                <PortalButton />
              </div>
            ) : (
              <UpgradeButton />
            )}
          </CardContent>
        </Card>
      </section>

      <p className="text-center text-xs text-muted-foreground">
        Los precios pueden variar por región. Stripe procesa todos los pagos.
        Cancela cuando quieras desde el portal.
      </p>
    </main>
  );
}
