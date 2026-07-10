import { NextResponse } from "next/server";
import { parseXExport } from "@/lib/textJob/parseExport";
import { quoteArchive } from "@/lib/textJob/quote";
import { getOwner } from "@/lib/xOwner";
import { createJob } from "@/lib/textJob/jobStore";
import { MAX_ARCHIVE_BYTES } from "@/lib/textJob/constants";

// The whole multipart body, not just the archive JSON the parser will later
// measure against MAX_ARCHIVE_BYTES — a compressed zip well under that limit
// could still arrive inside an oversized or abusive request envelope.
const MAX_REQUEST_BYTES = 2 * 1024 * 1024;

function refusal(reason: string, status: number) {
  return NextResponse.json({ ok: false, reason }, { status });
}

/**
 * POST /api/text/job  multipart/form-data, field "zip"
 *
 * Parses the visitor's own X export, quotes it, and opens an ephemeral job
 * in the paid inscription pipeline. Never returns the archive payload or
 * any key material — those exist only server-side until the worker
 * inscribes or sweeps.
 *
 * The 2 megabyte cap is checked twice: once against the Content-Length
 * header before the body is read at all (the fast path for a well-behaved
 * client that reports its size upfront), and again against the actual
 * decoded file bytes afterward, since a request without a reported length
 * still has to be read into memory once it's here.
 */
export async function POST(req: Request) {
  const contentLengthHeader = req.headers.get("content-length");
  const contentLength = contentLengthHeader === null ? null : Number(contentLengthHeader);
  if (contentLength !== null && Number.isFinite(contentLength) && contentLength > MAX_REQUEST_BYTES) {
    return refusal("too-large", 413);
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return refusal("bad-input", 400);
  }

  const file = form.get("zip");
  if (!(file instanceof File)) {
    return refusal("bad-input", 400);
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  if (bytes.byteLength > MAX_REQUEST_BYTES) {
    return refusal("too-large", 413);
  }

  const parsed = parseXExport(bytes, MAX_ARCHIVE_BYTES);
  if (!parsed.ok) {
    return refusal(parsed.reason, 422);
  }

  const quote = quoteArchive(parsed.archiveBytes);
  const owner = await getOwner(parsed.handle);
  const created = await createJob(parsed, quote, Date.now());
  if (!created.ok) {
    return refusal(created.refused, 503);
  }

  return NextResponse.json({
    jobId: created.job.jobId,
    priceSats: created.job.priceSats,
    feeSats: created.job.feeSats,
    premiumSats: created.job.premiumSats,
    expiresAtMs: created.job.expiresAtMs,
    claimedHandle: Boolean(owner),
    ...(owner
      ? {
          notice: `@${parsed.handle} is already claimed by another key. Anyone can still archive this account, but only the owner's key can register the result under that handle.`,
        }
      : {}),
  });
}
