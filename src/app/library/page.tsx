import { FileText, Upload } from "lucide-react";
import { redirect } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function LibraryPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Sprint 3 will list the user's uploaded PDFs from public.documents.
  const documents: never[] = [];

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-6 py-12">
      <header className="flex items-end justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-semibold tracking-tight">Biblioteca</h1>
          <p className="text-sm text-muted-foreground">
            Tus PDFs y los cuestionarios generados a partir de ellos.
          </p>
        </div>
        <Button disabled>
          <Upload />
          Subir PDF
        </Button>
      </header>

      {documents.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <div className="flex size-12 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <FileText className="size-6" />
            </div>
            <h2 className="text-lg font-medium">Tu biblioteca está vacía</h2>
            <p className="max-w-sm text-sm text-muted-foreground">
              La carga de PDFs llega en Sprint 3 (semana 4). Por ahora puedes
              cerrar sesión o explorar la home.
            </p>
          </CardContent>
        </Card>
      ) : null}
    </main>
  );
}
