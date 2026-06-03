import { LogOut, Sparkles, UserRound } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { SignOutButton } from "@/components/account/sign-out-button";
import { PortalButton } from "@/components/billing/portal-button";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getUserPlan } from "@/lib/billing/plan";
import { cn } from "@/lib/utils";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata = { title: "Cuenta" };

export default async function AccountPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login?next=/account");
  }

  const plan = await getUserPlan(user.id);
  const displayName =
    (user.user_metadata?.full_name as string | undefined) ??
    (user.user_metadata?.name as string | undefined) ??
    user.email ??
    "Cuenta";

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-6 py-12">
      <header className="flex flex-col gap-1">
        <h1 className="text-3xl font-semibold tracking-tight">Cuenta</h1>
        <p className="text-sm text-muted-foreground">
          Tu sesión y suscripción.
        </p>
      </header>

      <Card>
        <CardContent className="flex items-center gap-4 py-6">
          <div className="flex size-12 items-center justify-center rounded-full bg-primary/15 text-primary">
            <UserRound className="size-6" />
          </div>
          <div className="flex flex-1 flex-col gap-1 overflow-hidden">
            <p className="truncate font-medium">{displayName}</p>
            {user.email && (
              <p className="truncate text-xs text-muted-foreground">
                {user.email}
              </p>
            )}
          </div>
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
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex flex-col gap-3 py-6">
          <h2 className="text-sm font-semibold">Suscripción</h2>
          <p className="text-xs text-muted-foreground">
            Estado actual: <span className="capitalize">{plan.status}</span> ·
            Plan: <span className="capitalize">{plan.plan}</span>
          </p>
          {plan.plan === "free" ? (
            <Link
              href="/pricing"
              className={cn(buttonVariants({ size: "sm" }), "self-start")}
            >
              <Sparkles />
              Pasar a Pro
            </Link>
          ) : (
            <PortalButton size="sm" />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex flex-col gap-3 py-6">
          <h2 className="text-sm font-semibold">Sesión</h2>
          <p className="text-xs text-muted-foreground">
            Cerrá sesión en este dispositivo. Tus datos quedan guardados y
            volvés a verlos al iniciar sesión de nuevo.
          </p>
          <div className="self-start">
            <SignOutButton>
              <Button variant="outline" size="sm">
                <LogOut />
                Cerrar sesión
              </Button>
            </SignOutButton>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
