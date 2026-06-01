import { NextResponse } from "next/server";

import { countDocumentsThisMonth, getUserPlan } from "@/lib/billing/plan";
import { extractExtension } from "@/lib/documents/extension";
import { parseDocument, ParseError } from "@/lib/documents/parsers";
import { chunkText } from "@/lib/pdf/chunk";
import {
  detectSuspiciousContent,
  SUSPICIOUS_CONTENT_WARNING,
} from "@/lib/pdf/suspicious";
import { checkRateLimit } from "@/lib/rate-limit";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseServiceClient } from "@/lib/supabase/service";

/** Sanity ceiling on extracted text — a 1M-char document is already
 * ~250K tokens, well beyond what's useful to feed an LLM. */
const MAX_EXTRACTED_CHARS = 1_000_000;

/** Mirror of the client-side cap (advisory in the client, enforced here). */
const MAX_BYTES = 25 * 1024 * 1024;

/**
 * POST /api/documents/extract
 * Body: { document_id: string }
 *
 * Flow:
 *  1. Auth + per-user rate limit + monthly plan gate.
 *  2. Verify ownership of the document row, mark status='extracting'.
 *  3. Download the file from Storage, validate size.
 *  4. Detect format by storage_path extension and dispatch to the right
 *     parser (PDF + OCR fallback, DOCX, TXT, MD).
 *  5. Apply sanity ceiling and prompt-injection heuristic.
 *  6. Chunk text + bulk insert + mark document status='ready'.
 *
 * Errors are returned as both HTTP status codes and persisted on the
 * document row so the UI can render them later.
 */
export const runtime = "nodejs";
export const maxDuration = 60;

type ExtractBody = { document_id: string };

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const rateLimit = await checkRateLimit(
    { prefix: "doc-extract", requests: 10, window: "1 h" },
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

  const plan = await getUserPlan(user.id);
  const usedThisMonth = await countDocumentsThisMonth(user.id);
  if (usedThisMonth > plan.limits.documentsPerMonth) {
    return NextResponse.json(
      {
        error: "plan_limit_exceeded",
        detail: `Tu plan ${plan.plan} permite ${plan.limits.documentsPerMonth} documentos al mes. Llevas ${usedThisMonth}.`,
        limit: plan.limits.documentsPerMonth,
        used: usedThisMonth,
        plan: plan.plan,
      },
      { status: 402 },
    );
  }

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

  const extension = extractExtension(document.storage_path);

  await service
    .from("documents")
    .update({ status: "extracting", error_message: null })
    .eq("id", document.id);

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

  if (file.size > MAX_BYTES) {
    await markFailed(
      document.id,
      `El archivo excede el límite de 25 MB (real: ${(file.size / 1024 / 1024).toFixed(1)} MB).`,
    );
    return NextResponse.json(
      {
        error: "file_too_large",
        limit_bytes: MAX_BYTES,
        actual_bytes: file.size,
      },
      { status: 413 },
    );
  }

  const buffer = new Uint8Array(await file.arrayBuffer());

  // Parse using the format-specific dispatcher.
  let parseResult;
  try {
    parseResult = await parseDocument(buffer, extension);
  } catch (err) {
    if (err instanceof ParseError) {
      await markFailed(document.id, err.message);
      const status =
        err.code === "too_many_pages"
          ? 413
          : err.code === "invalid_signature"
            ? 422
            : err.code === "extract_timeout"
              ? 504
              : err.code === "empty_text"
                ? 422
                : err.code === "ocr_failed"
                  ? 422
                  : 422;
      return NextResponse.json(
        { error: err.code, detail: err.message, ...(err.meta ?? {}) },
        { status },
      );
    }
    const message = err instanceof Error ? err.message : "parse_failed";
    await markFailed(document.id, message);
    return NextResponse.json(
      { error: "parse_failed", detail: message },
      { status: 500 },
    );
  }

  const { text: fullText, pageCount, ocrUsed } = parseResult;

  if (fullText.trim().length === 0) {
    await markFailed(document.id, "El documento no contiene texto extraíble.");
    return NextResponse.json({ error: "empty_text" }, { status: 422 });
  }

  if (fullText.length > MAX_EXTRACTED_CHARS) {
    await markFailed(
      document.id,
      `Texto extraído de ${fullText.length} caracteres excede el límite de ${MAX_EXTRACTED_CHARS}. Reduce el documento.`,
    );
    return NextResponse.json(
      {
        error: "text_too_long",
        chars: fullText.length,
        limit: MAX_EXTRACTED_CHARS,
      },
      { status: 413 },
    );
  }

  const suspicionReport = detectSuspiciousContent(fullText);
  if (suspicionReport.suspicious) {
    console.warn(
      `[documents-extract] document ${document.id} flagged as suspicious:`,
      suspicionReport.reasons.join("; "),
    );
  }

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
      content: suspicionReport.suspicious
        ? SUSPICIOUS_CONTENT_WARNING + c.content
        : c.content,
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

  // For formats without natural pages (.docx/.txt/.md), pageCount is 0 —
  // store null so the UI doesn't render "0 págs".
  await service
    .from("documents")
    .update({
      status: "ready",
      error_message: null,
      page_count: pageCount > 0 ? pageCount : null,
    })
    .eq("id", document.id);

  return NextResponse.json({
    chunks: chunks.length,
    pages: pageCount,
    ocr_used: ocrUsed,
  });
}

async function markFailed(documentId: string, errorMessage: string) {
  const service = getSupabaseServiceClient();
  await service
    .from("documents")
    .update({ status: "failed", error_message: errorMessage })
    .eq("id", documentId);
}
