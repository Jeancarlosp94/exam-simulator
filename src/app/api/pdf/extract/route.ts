import { NextResponse } from "next/server";
import { extractText, getDocumentProxy } from "unpdf";

import { chunkText } from "@/lib/pdf/chunk";
import { checkRateLimit } from "@/lib/rate-limit";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseServiceClient } from "@/lib/supabase/service";

/**
 * POST /api/pdf/extract
 * Body: { document_id: string }
 *
 * Flow:
 *  1. Authenticate via cookie session.
 *  2. Rate limit by user id (10/hour by default — bypassed if Upstash unset).
 *  3. Look up the document with the service client, verify ownership.
 *  4. Mark status='extracting'.
 *  5. Download the PDF bytes from Storage.
 *  6. Extract text with unpdf, chunk it.
 *  7. Bulk-insert chunks and mark document status='ready' (or 'failed').
 *
 * Returns: { chunks: number, pages: number } on success.
 *
 * Errors are surfaced both as HTTP status codes and (for permanent ones)
 * persisted on the document row so the UI can render them later.
 */
export const runtime = "nodejs";
export const maxDuration = 60;

type ExtractBody = { document_id: string };

export async function POST(request: Request) {
  // 1. Auth
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // 2. Rate limit (10 extractions/hour per user — enough for normal use,
  //    not enough to burn through credits if someone scripts an attack).
  const rateLimit = await checkRateLimit(
    { prefix: "pdf-extract", requests: 10, window: "1 h" },
    user.id,
  );
  if (!rateLimit.ok) {
    return NextResponse.json(
      {
        error: "rate_limited",
        retry_after_seconds: rateLimit.retryAfterSeconds,
      },
      {
        status: 429,
        headers: { "Retry-After": String(rateLimit.retryAfterSeconds) },
      },
    );
  }

  // 3. Parse body and verify document ownership
  let body: ExtractBody;
  try {
    body = (await request.json()) as ExtractBody;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  if (!body.document_id || typeof body.document_id !== "string") {
    return NextResponse.json({ error: "missing_document_id" }, { status: 400 });
  }

  const service = getSupabaseServiceClient();
  const { data: document, error: docError } = await service
    .from("documents")
    .select("id, user_id, storage_path, status")
    .eq("id", body.document_id)
    .single();

  if (docError || !document) {
    return NextResponse.json({ error: "document_not_found" }, { status: 404 });
  }
  if (document.user_id !== user.id) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  if (document.status === "ready") {
    return NextResponse.json({ error: "already_extracted" }, { status: 409 });
  }

  // 4. Mark extracting
  await service
    .from("documents")
    .update({ status: "extracting", error_message: null })
    .eq("id", document.id);

  // 5. Download from Storage
  const { data: file, error: downloadError } = await service.storage
    .from("documents")
    .download(document.storage_path);
  if (downloadError || !file) {
    await markFailed(document.id, downloadError?.message ?? "download_failed");
    return NextResponse.json(
      { error: "download_failed", detail: downloadError?.message },
      { status: 500 },
    );
  }

  // 6. Extract text
  let totalPages = 0;
  let fullText = "";
  try {
    const buffer = new Uint8Array(await file.arrayBuffer());
    const pdf = await getDocumentProxy(buffer);
    totalPages = pdf.numPages;
    const result = await extractText(pdf, { mergePages: true });
    fullText = Array.isArray(result.text)
      ? result.text.join("\n\n")
      : result.text;
  } catch (error) {
    const message = error instanceof Error ? error.message : "pdf_parse_failed";
    await markFailed(document.id, message);
    return NextResponse.json(
      { error: "pdf_parse_failed", detail: message },
      { status: 422 },
    );
  }

  if (fullText.trim().length === 0) {
    await markFailed(
      document.id,
      "El PDF no contiene texto extraíble. Si es un escaneado, OCR aún no está soportado.",
    );
    return NextResponse.json({ error: "empty_text" }, { status: 422 });
  }

  // 7. Chunk + insert
  const chunks = chunkText(fullText);
  if (chunks.length === 0) {
    await markFailed(document.id, "chunker_returned_zero_chunks");
    return NextResponse.json(
      { error: "chunker_returned_zero_chunks" },
      { status: 500 },
    );
  }

  const { error: insertError } = await service.from("document_chunks").insert(
    chunks.map((c) => ({
      document_id: document.id,
      chunk_index: c.index,
      content: c.content,
      token_count: c.approxTokens,
    })),
  );
  if (insertError) {
    await markFailed(document.id, insertError.message);
    return NextResponse.json(
      { error: "chunk_insert_failed", detail: insertError.message },
      { status: 500 },
    );
  }

  await service
    .from("documents")
    .update({ status: "ready", page_count: totalPages, error_message: null })
    .eq("id", document.id);

  return NextResponse.json({ chunks: chunks.length, pages: totalPages });
}

async function markFailed(documentId: string, errorMessage: string) {
  const service = getSupabaseServiceClient();
  await service
    .from("documents")
    .update({ status: "failed", error_message: errorMessage })
    .eq("id", documentId);
}
