"use client";

import { FileText, Upload as UploadIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
} from "react";
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
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

const MAX_BYTES = 25 * 1024 * 1024; // 25 MB

type Phase = "idle" | "uploading" | "extracting" | "done" | "error";

export default function UploadPage() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [titleEdited, setTitleEdited] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [progress, setProgress] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleFile = useCallback(
    (next: File | null) => {
      if (!next) return;
      if (!next.name.toLowerCase().endsWith(".pdf")) {
        toast.error("Solo se aceptan archivos PDF.");
        return;
      }
      if (next.size > MAX_BYTES) {
        toast.error(
          `El archivo es demasiado grande (${(next.size / 1024 / 1024).toFixed(1)} MB). Límite: 25 MB.`,
        );
        return;
      }
      setFile(next);
      if (!titleEdited) {
        setTitle(next.name.replace(/\.pdf$/i, ""));
      }
      setErrorMessage(null);
      setPhase("idle");
    },
    [titleEdited],
  );

  function handleSelect(event: ChangeEvent<HTMLInputElement>) {
    handleFile(event.target.files?.[0] ?? null);
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragging(false);
    handleFile(event.dataTransfer.files[0] ?? null);
  }

  async function handleSubmit() {
    if (!file) return;
    if (title.trim().length === 0) {
      toast.error("Dale un título al documento.");
      return;
    }

    setPhase("uploading");
    setProgress(5);
    setErrorMessage(null);

    const supabase = createSupabaseBrowserClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      setPhase("error");
      setErrorMessage("Sesión expirada. Inicia sesión de nuevo.");
      router.push("/login");
      return;
    }

    const documentId = crypto.randomUUID();
    const storagePath = `${user.id}/${documentId}.pdf`;

    // 1. Insert documents row (RLS enforces user_id = auth.uid()).
    const { error: insertError } = await supabase.from("documents").insert({
      id: documentId,
      user_id: user.id,
      title: title.trim(),
      storage_path: storagePath,
      size_bytes: file.size,
      status: "uploading",
    });
    if (insertError) {
      setPhase("error");
      setErrorMessage(insertError.message);
      toast.error(`No pudimos registrar el documento: ${insertError.message}`);
      return;
    }

    setProgress(20);

    // 2. Upload to Storage. Storage policy enforces that the first path
    //    segment equals auth.uid()::text.
    const { error: uploadError } = await supabase.storage
      .from("documents")
      .upload(storagePath, file, {
        contentType: "application/pdf",
        cacheControl: "3600",
        upsert: false,
      });
    if (uploadError) {
      setPhase("error");
      setErrorMessage(uploadError.message);
      toast.error(`Falló la subida: ${uploadError.message}`);
      // Clean up the orphan row so /library doesn't show a phantom doc.
      await supabase.from("documents").delete().eq("id", documentId);
      return;
    }

    setProgress(60);
    setPhase("extracting");

    // 3. Fire extraction. The route handler updates the document status.
    const extractResponse = await fetch("/api/pdf/extract", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ document_id: documentId }),
    });

    if (!extractResponse.ok) {
      const payload = (await extractResponse.json().catch(() => ({}))) as {
        error?: string;
        detail?: string;
      };
      setPhase("error");
      const detail = payload.detail ?? payload.error ?? "extract_failed";
      setErrorMessage(detail);
      toast.error(`La extracción falló: ${detail}`);
      return;
    }

    const { chunks, pages } = (await extractResponse.json()) as {
      chunks: number;
      pages: number;
    };

    setProgress(100);
    setPhase("done");
    toast.success(`Listo. ${pages} páginas, ${chunks} chunks.`);
    setTimeout(() => router.push("/library"), 1200);
  }

  const isWorking = phase === "uploading" || phase === "extracting";

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-6 py-12">
      <header className="flex flex-col gap-1">
        <h1 className="text-3xl font-semibold tracking-tight">Subir PDF</h1>
        <p className="text-sm text-muted-foreground">
          Sube un documento de hasta 25 MB. La IA lo procesa y queda listo para
          generar cuestionarios.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Archivo</CardTitle>
          <CardDescription>
            Arrastra el PDF aquí o selecciónalo desde tu equipo.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div
            onDrop={handleDrop}
            onDragOver={(event) => {
              event.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onClick={() => inputRef.current?.click()}
            className={cn(
              "flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-10 text-center transition-colors",
              isDragging
                ? "border-primary bg-primary/5"
                : "border-border hover:border-primary/40 hover:bg-card/50",
            )}
            role="button"
            tabIndex={0}
          >
            <FileText className="size-10 text-primary" aria-hidden />
            {file ? (
              <>
                <p className="font-medium">{file.name}</p>
                <p className="text-xs text-muted-foreground">
                  {(file.size / 1024 / 1024).toFixed(2)} MB
                </p>
              </>
            ) : (
              <>
                <p className="font-medium">
                  Arrastra tu PDF o haz clic para elegir
                </p>
                <p className="text-xs text-muted-foreground">Máximo 25 MB</p>
              </>
            )}
            <input
              ref={inputRef}
              type="file"
              accept="application/pdf,.pdf"
              className="hidden"
              onChange={handleSelect}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="title">Título</Label>
            <Input
              id="title"
              value={title}
              onChange={(event) => {
                setTitle(event.target.value);
                setTitleEdited(true);
              }}
              placeholder="Capítulo 3 — Cinética química"
              disabled={isWorking}
            />
          </div>

          {phase !== "idle" && (
            <div className="space-y-2">
              <Progress value={progress} />
              <p className="text-xs text-muted-foreground">
                {phase === "uploading" && "Subiendo archivo..."}
                {phase === "extracting" && "Extrayendo texto..."}
                {phase === "done" && "Listo. Redirigiendo a tu biblioteca..."}
                {phase === "error" && (errorMessage ?? "Algo falló.")}
              </p>
            </div>
          )}

          <div className="flex justify-end gap-3">
            <Button
              variant="outline"
              onClick={() => router.push("/library")}
              disabled={isWorking}
            >
              Cancelar
            </Button>
            <Button onClick={handleSubmit} disabled={!file || isWorking}>
              <UploadIcon />
              {phase === "uploading"
                ? "Subiendo..."
                : phase === "extracting"
                  ? "Procesando..."
                  : "Subir y procesar"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
