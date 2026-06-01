import { NextResponse } from "next/server";
import { extractText, getDocumentProxy } from "unpdf";

import { countDocumentsThisMonth, getUserPlan } from "@/lib/billing/plan";
import { chunkText } from "@/lib/pdf/chunk";
import {
  detectSuspiciousContent,
  SUSPICIOUS_CONTENT_WARNING,
} from "@/lib/pdf/suspicious";
import { checkRateLimit } from "@/lib/rate-limit";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseServiceClient } from "@/lib/supabase/service";

/** Max pages we'll process. Above this we bail before extracting to
 * avoid OOM / timeout from malicious or oversized PDFs. */
const MAX_PAGES = 200;

/** Hard timeout for unpdf's extractText call. Vercel kills the function
 * at maxDuration anyway, but this gives us a clean error before the
 * runtime SIGTERMs us mid-write to the DB. */
const EXTRACT_TIMEOUT_MS = 45_000;

/** Max characters in the joined extracted text. A 200-page PDF averages
 * ~250K chars; 1M is a sanity ceiling. */
const MAX_EXTRACTED_CHARS = 1_000_000;

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

  // 2. Rate limit (10 extractions/hour per user — burst protection,
  //    separate from the monthly plan cap below).
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

  // 3. Plan gate — monthly document count. The document row was already
  //    inserted by the client during upload; we check at extract time so
  //    we don't waste an Anthropic-sized read on a doc we're going to
  //    refuse to process. Free: 3/month, Pro: 30/month.
  const plan = await getUserPlan(user.id);
  const usedThisMonth = await countDocumentsThisMonth(user.id);
  // The current document is already counted in usedThisMonth (it was
  // inserted before this POST). Allow it through if usedThisMonth <= limit
  // so the user can actually use their last allowed slot.
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

  // 5b. Server-side validation: size + magic bytes. The client validates
  // these too but client checks are advisory — never trust them for security.
  const MAX_BYTES = 25 * 1024 * 1024; // mirror the client limit
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

  // PDF magic bytes are "%PDF-" (0x25 0x50 0x44 0x46 0x2D). Rejecting
  // mismatches stops a malicious upload from passing a renamed binary
  // as a PDF and crashing unpdf in unexpected ways downstream.
  const PDF_MAGIC = [0x25, 0x50, 0x44, 0x46, 0x2d];
  const hasPdfMagic =
    buffer.length >= PDF_MAGIC.length &&
    PDF_MAGIC.every((byte, i) => buffer[i] === byte);
  if (!hasPdfMagic) {
    await markFailed(
      document.id,
      "El archivo no parece ser un PDF válido (magic bytes incorrectos).",
    );
    return NextResponse.json(
      { error: "invalid_pdf_signature" },
      { status: 422 },
    );
  }

  // 6. Extract text — with page-count gate and hard timeout
  let totalPages = 0;
  let fullText = "";
  try {
    const pdf = await getDocumentProxy(buffer);
    totalPages = pdf.numPages;

    // Page count cap: bail before extract on adversarial / oversized PDFs.
    if (totalPages > MAX_PAGES) {
      await markFailed(
        document.id,
        `PDF tiene ${totalPages} páginas (límite ${MAX_PAGES}).`,
      );
      return NextResponse.json(
        {
          error: "too_many_pages",
          pages: totalPages,
          limit: MAX_PAGES,
        },
        { status: 413 },
      );
    }

    // Hard timeout on extractText. Defends against PDFs structured to make
    // pdf.js loop or allocate forever — Vercel will SIGTERM us at maxDuration
    // either way, but a clean rejection here lets us mark the document
    // failed with a sensible error_message rather than leaving it in
    // 'extracting' limbo.
    const result = await Promise.race([
      extractText(pdf, { mergePages: true }),
      new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error("extract_timeout")),
          EXTRACT_TIMEOUT_MS,
        ),
      ),
    ]);

    fullText = Array.isArray(result.text)
      ? result.text.join("\n\n")
      : result.text;
  } catch (error) {
    const message = error instanceof Error ? error.message : "pdf_parse_failed";
    await markFailed(document.id, message);
    const status = message === "extract_timeout" ? 504 : 422;
    return NextResponse.json(
      {
        error:
          message === "extract_timeout"
            ? "extract_timeout"
            : "pdf_parse_failed",
        detail: message,
      },
      { status },
    );
  }

  if (fullText.trim().length === 0) {
    await markFailed(
      document.id,
      "El PDF no contiene texto extraíble. Si es un escaneado, OCR aún no está soportado.",
    );
    return NextResponse.json({ error: "empty_text" }, { status: 422 });
  }

  // Sanity ceiling on extracted size — a 1M char document is already
  // ~250K tokens, well beyond what's useful to feed an LLM.
  if (fullText.length > MAX_EXTRACTED_CHARS) {
    await markFailed(
      document.id,
      `Texto extraído de ${fullText.length} caracteres excede el límite de ${MAX_EXTRACTED_CHARS}. Reduce el PDF.`,
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

  // 6b. Suspicion heuristic — flag if document looks like a prompt-injection
  // attempt. We don't reject the document (false positives would hurt legit
  // academic content about prompt engineering); instead we add a runtime
  // warning to each chunk so the LLM sees it alongside the static system
  // prompt rules.
  const suspicionReport = detectSuspiciousContent(fullText);
  if (suspicionReport.suspicious) {
    console.warn(
      `[pdf-extract] document ${document.id} flagged as suspicious:`,
      suspicionReport.reasons.join("; "),
    );
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

  // If suspicious content was detected, prepend the warning to every
  // chunk's stored content. The warning travels with the chunk into
  // every downstream LLM call (quiz gen + tutor), reinforcing the
  // static system-prompt rules with runtime context.
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
