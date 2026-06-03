"use client";

import { Check, Copy, Share2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

type Props = {
  quizId: string;
  quizTitle: string;
  trigger?: React.ReactNode;
};

/**
 * Generates (or reuses) the public share link for a quiz and offers a
 * one-click copy + native share fallback. The POST to /api/quiz/share is
 * idempotent for active shares, so re-opening the dialog returns the same
 * URL instead of minting new ones.
 */
export function ShareDialog({ quizId, quizTitle, trigger }: Props) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [copied, setCopied] = useState(false);

  async function fetchUrl() {
    setPending(true);
    try {
      const res = await fetch("/api/quiz/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quiz_id: quizId }),
      });
      if (!res.ok) {
        const payload = (await res.json().catch(() => ({}))) as {
          error?: string;
          detail?: string;
        };
        toast.error(
          payload.detail ?? payload.error ?? "No pudimos generar el link.",
        );
        return;
      }
      const data = (await res.json()) as { slug: string; url: string };
      setUrl(data.url);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "No pudimos generar el link.",
      );
    } finally {
      setPending(false);
    }
  }

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next && url === null && !pending) {
      void fetchUrl();
    }
    if (!next) {
      setCopied(false);
    }
  }

  async function handleCopy() {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("Link copiado.");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("No pudimos copiar. Seleccioná el texto manualmente.");
    }
  }

  async function handleNativeShare() {
    if (!url) return;
    if (typeof navigator !== "undefined" && "share" in navigator) {
      try {
        await navigator.share({
          title: `Quiz: ${quizTitle}`,
          text: "Te reto a este quiz en Quizen",
          url,
        });
      } catch {
        /* user dismissed; nothing to do */
      }
    } else {
      void handleCopy();
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={
          (trigger as React.ReactElement) ?? (
            <Button variant="outline">
              <Share2 />
              Compartir
            </Button>
          )
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Compartir quiz</DialogTitle>
          <DialogDescription>
            Cualquiera con este link puede jugar este quiz sin crear cuenta. Sus
            respuestas no se guardan.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          {pending && !url ? (
            <p className="text-sm text-muted-foreground">Generando link...</p>
          ) : url ? (
            <div className="flex gap-2">
              <Input value={url} readOnly className="font-mono text-xs" />
              <Button
                size="icon"
                variant="outline"
                onClick={handleCopy}
                title="Copiar"
              >
                {copied ? <Check /> : <Copy />}
              </Button>
            </div>
          ) : (
            <p className="text-sm text-destructive">
              No pudimos generar el link. Intentá de nuevo.
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cerrar
          </Button>
          <Button onClick={handleNativeShare} disabled={!url}>
            <Share2 />
            Compartir
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
