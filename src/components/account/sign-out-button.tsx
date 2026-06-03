"use client";

import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";

import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type Props = {
  children: ReactNode;
};

/**
 * Wraps a child trigger (Button, link, etc.) with a click handler that
 * signs out via the browser Supabase client and routes to /login. We
 * keep this small so the Account page server component can stay a server
 * component and just hand off to this island.
 */
export function SignOutButton({ children }: Props) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function handleClick() {
    if (pending) return;
    setPending(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.auth.signOut();
      if (error) {
        toast.error(`No pudimos cerrar sesión: ${error.message}`);
        return;
      }
      router.replace("/login");
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <div onClick={handleClick} role="button" tabIndex={-1}>
      {children}
    </div>
  );
}
