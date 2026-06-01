import { WifiOff } from "lucide-react";
import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";

/**
 * Offline fallback. Served by the service worker when an HTML
 * navigation fails AND no cached version of the requested page exists.
 *
 * Kept intentionally simple — no client JS, no fetches, nothing that
 * requires network. The user is offline; this should render from cache.
 */
export const dynamic = "force-static";

export default function OfflinePage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-4 px-6 py-12 text-center">
      <div className="flex size-16 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <WifiOff className="size-8" />
      </div>
      <h1 className="text-2xl font-semibold">Sin conexión</h1>
      <p className="text-muted-foreground">
        No pudimos cargar esta página porque estás sin internet. Las cards de
        repaso que ya descargaste siguen funcionando.
      </p>
      <Link href="/library" className={buttonVariants({ variant: "outline" })}>
        Volver a biblioteca
      </Link>
    </main>
  );
}
