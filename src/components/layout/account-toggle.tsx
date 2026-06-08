import { UserRound } from "lucide-react";
import Link from "next/link";

import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Floating "Cuenta" button, top-right next to the ModeToggle. Visible
 * only when the user is authenticated — anonymous users have "Iniciar
 * sesión" in the landing header and don't need a placeholder here.
 *
 * On mobile the BottomNav also carries a "Cuenta" entry; this is the
 * desktop equivalent (sm:flex makes it appear only above the BottomNav's
 * breakpoint).
 */
export async function AccountToggle() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  return (
    <Link
      href="/account"
      aria-label="Cuenta y apariencia"
      title="Cuenta y apariencia"
      className="fixed right-14 top-3 z-30 hidden size-9 items-center justify-center rounded-full border border-border bg-card/80 text-muted-foreground shadow-sm backdrop-blur transition-colors hover:bg-card hover:text-foreground sm:flex"
    >
      <UserRound className="size-4" />
    </Link>
  );
}
