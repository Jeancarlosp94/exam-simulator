import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { signInWithGoogle } from "./actions";
import { GoogleSubmitButton } from "./google-submit-button";

type SearchParams = { error?: string; detail?: string };

/**
 * Server-rendered login page. The Google button is a real <form>
 * submission to a Server Action, so it works without JavaScript and
 * doesn't depend on client-side hydration completing — important for
 * slow networks and embedded mobile browsers.
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { error, detail } = await searchParams;

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
          <form action={signInWithGoogle}>
            <GoogleSubmitButton />
          </form>

          {error && (
            <p className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-center text-xs text-destructive">
              No pudimos iniciar sesión.
              {detail ? ` (${decodeURIComponent(detail)})` : ""}
            </p>
          )}

          <noscript>
            <p className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-center text-xs text-amber-300">
              Tu navegador tiene JavaScript desactivado. El login funciona igual
              — solo tocá &quot;Continuar con Google&quot;.
            </p>
          </noscript>

          <p className="text-center text-xs text-muted-foreground">
            Al continuar aceptas nuestros términos. No usamos tu material para
            entrenar modelos.
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
