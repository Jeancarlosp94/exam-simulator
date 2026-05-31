"use client";

import { useState, type FormEvent } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [magicLinkPending, setMagicLinkPending] = useState(false);
  const [googlePending, setGooglePending] = useState(false);

  async function handleMagicLink(event: FormEvent) {
    event.preventDefault();
    setMagicLinkPending(true);

    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    setMagicLinkPending(false);

    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Revisa tu email para iniciar sesión.");
  }

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
            Inicia sesión para subir tus PDFs y guardar tu progreso.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button
            variant="outline"
            className="w-full"
            onClick={handleGoogle}
            disabled={googlePending}
          >
            {googlePending ? "Redirigiendo..." : "Continuar con Google"}
          </Button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">o</span>
            </div>
          </div>

          <form onSubmit={handleMagicLink} className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="tu@email.com"
                required
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </div>
            <Button
              type="submit"
              className="w-full"
              disabled={magicLinkPending}
            >
              {magicLinkPending ? "Enviando..." : "Enviar enlace mágico"}
            </Button>
          </form>

          <p className="text-center text-xs text-muted-foreground">
            Al continuar aceptas nuestros términos. No usamos tu material para
            entrenar modelos.
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
