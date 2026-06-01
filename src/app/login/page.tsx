"use client";

import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [googlePending, setGooglePending] = useState(false);

  async function handleGoogle() {
    setGooglePending(true);

    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      setGooglePending(false);
      toast.error(error.message);
    }
    // On success the browser is redirected to Google; no state to clear.
  }

  return (
    <main className="flex flex-1 items-center justify-center px-6 py-12">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Bienvenido a Quizen</CardTitle>
          <CardDescription>
            Inicia sesión con Google para subir tus documentos y guardar tu
            progreso.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button
            className="w-full"
            onClick={handleGoogle}
            disabled={googlePending}
          >
            {googlePending ? "Redirigiendo..." : "Continuar con Google"}
          </Button>

          <p className="text-center text-xs text-muted-foreground">
            Al continuar aceptas nuestros términos. No usamos tu material para
            entrenar modelos.
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
