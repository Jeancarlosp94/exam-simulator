import {
  ArrowLeft,
  Bell,
  LogOut,
  Palette,
  Sparkles,
  UserRound,
} from "lucide-react";
import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";

import { PushToggle } from "@/components/account/push-toggle";
import { SignOutButton } from "@/components/account/sign-out-button";
import { ThemePicker } from "@/components/account/theme-picker";
import { PortalButton } from "@/components/billing/portal-button";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getUserPlan } from "@/lib/billing/plan";
import { parseTheme, THEME_COOKIE } from "@/lib/theme";
import { cn } from "@/lib/utils";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseServiceClient } from "@/lib/supabase/service";

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

  // Prefer the DB value over the cookie so cross-device users always get
  // their last saved theme; fall back to cookie for first paint or anon.
  const cookieStore = await cookies();
  const service = getSupabaseServiceClient();
  const { data: profile } = await service
    .from("profiles")
    .select("theme_settings")
    .eq("id", user.id)
    .maybeSingle();
  const initialTheme =
    profile?.theme_settings ?? parseTheme(cookieStore.get(THEME_COOKIE)?.value);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-6 py-12">
      <Link
        href="/library"
        className={cn(
          buttonVariants({ variant: "ghost", size: "sm" }),
          "self-start -ml-2 text-muted-foreground hover:text-foreground",
        )}
      >
        <ArrowLeft />
        Volver a biblioteca
      </Link>

      <header className="flex flex-col gap-1">
        <h1 className="text-3xl font-semibold tracking-tight">Cuenta</h1>
        <p className="text-sm text-muted-foreground">
          Tu sesión, suscripción y apariencia. Los cambios se guardan al
          instante.
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
          <div className="flex items-center gap-2">
            <Palette className="size-4 text-primary" />
            <h2 className="text-sm font-semibold">Apariencia</h2>
          </div>
          <p className="text-xs text-muted-foreground">
            Elegí una paleta, el modo (Enfocado para deep work, Relajado para
            lecturas largas) y el brillo. Los cambios se aplican al instante.
          </p>
          <ThemePicker initial={initialTheme} />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex flex-col gap-3 py-6">
          <div className="flex items-center gap-2">
            <Bell className="size-4 text-primary" />
            <h2 className="text-sm font-semibold">Notificaciones</h2>
          </div>
          <p className="text-xs text-muted-foreground">
            Recibí una notificación cada mañana con las tarjetas listas para
            repasar. Funciona aunque la app esté cerrada (en Android — en iOS
            necesitás tener la PWA instalada en pantalla de inicio).
          </p>
          <PushToggle />
          <p className="text-xs text-muted-foreground">
            Activá por dispositivo. Si usás tablet y celular y querés notif en
            ambos, activá desde cada uno.
          </p>
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
