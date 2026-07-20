import { NextResponse } from "next/server";
import { Hash, Utils } from "@bsv/sdk";
import {
  COMMENT_MAX,
  TITLE_MAX,
  encodeRecord,
  validateComment,
  validateLink,
  type FolkloreRecord,
} from "@/app/folklore/linkRecord";
import { readLinkRecord } from "@/lib/folkloreBoard";
import { createJob } from "@/lib/folkloreJob/jobStore";
import { claimSubmitSlot, clientAddress } from "@/lib/folkloreJob/submitThrottle";
import { quoteLink } from "@/lib/folkloreJob/linkQuote";
import { gbpPerBsv } from "@/lib/xPrice";

// The whole request envelope. An honest submission is under eleven kilobytes
// (title 300, comment 10,000, a url); sixty-four kilobytes is generous slack
// before anything is read into memory.
const MAX_REQUEST_BYTES = 64 * 1024;

// The same handle rule the export parser and register route enforce — `by`
// is a claimed X handle, so anything that could not be one refuses here.
const BY_PATTERN = /^[A-Za-z0-9_]{1,15}$/;

function refusal(reason: string, status: number) {
  return NextResponse.json({ ok: false, reason }, { status });
}

/** The named refusal, or the validated record. Reason-naming never replaces
 * the validators as the gate: each arm only says which validator check
 * refused; the record itself always comes from validateLink/validateComment. */
function recordFromBody(body: Record<string, unknown>): { record: FolkloreRecord } | { reason: string } {
  const by = body.by === undefined ? undefined : typeof body.by === "string" ? body.by : null;
  if (by === null) return { reason: "bad-by" };
  if (by !== undefined && !BY_PATTERN.test(by)) return { reason: "bad-by" };

  if (body.kind === "link") {
    const { url, title } = body;
    if (typeof url !== "string" || typeof title !== "string") return { reason: "bad-input" };
    if (title.trim().length > TITLE_MAX) return { reason: "title-too-long" };
    const record = validateLink(url, title, by);
    if (!record) return { reason: title.trim().length === 0 ? "bad-title" : "bad-url" };
    return { record };
  }

  if (body.kind === "comment") {
    const { parent, text } = body;
    if (typeof parent !== "string" || typeof text !== "string") return { reason: "bad-input" };
    if (text.trim().length > COMMENT_MAX) return { reason: "comment-too-long" };
    const record = validateComment(parent, text, by);
    if (!record) return { reason: text.trim().length === 0 ? "bad-text" : "bad-parent" };
    return { record };
  }

  return { reason: "bad-input" };
}

/**
 * POST /api/folklore/link  application/json
 *
 *   { "kind": "link",    "url": "https://…", "title": "…", "by"?: "handle" }
 *   { "kind": "comment", "parent": "<txid>", "text": "…",  "by"?: "handle" }
 *
 * The only submit path for single links and comments (spec Decision 4): the
 * record is validated, quoted at the inscription fee plus the ten-pence
 * floor, and opened as an ephemeral job on the same custodial rails the web
 * archive rides — the visitor then pays the job's address (served by the
 * existing GET /api/folklore/job/[id] poll once the worker publishes it) and
 * the worker inscribes the record and lands it on the board.
 */
export async function POST(req: Request) {
  // The exact-string gate, read per request like the archive route's — while
  // the flag is dark the whole pay pipeline stays unreachable, and the body
  // is never even read.
  if (process.env.FOLKLORE_SUBMIT_ENABLED !== "true") {
    return refusal("not-available", 503);
  }

  const contentLengthHeader = req.headers.get("content-length");
  const contentLength = contentLengthHeader === null ? null : Number(contentLengthHeader);
  if (contentLength !== null && Number.isFinite(contentLength) && contentLength > MAX_REQUEST_BYTES) {
    return refusal("too-large", 413);
  }

  let raw: string;
  try {
    raw = await req.text();
  } catch {
    return refusal("bad-input", 400);
  }
  if (new TextEncoder().encode(raw).byteLength > MAX_REQUEST_BYTES) {
    return refusal("too-large", 413);
  }

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return refusal("bad-input", 400);
  }
  if (typeof body !== "object" || body === null) {
    return refusal("bad-input", 400);
  }

  const validated = recordFromBody(body as Record<string, unknown>);
  if ("reason" in validated) {
    return refusal(validated.reason, 400);
  }
  const { record } = validated;

  // Submit-side courtesy (spec §8): a comment's parent must be a link the
  // board knows, so nobody pays to comment into the void. Chain-side orphans
  // stay legal — this gate exists only where money changes hands. The cached
  // record is also the moderation lever: a delisted link loses its cache, so
  // new comments on it refuse here too.
  if (record.kind === "comment") {
    const parent = await readLinkRecord(record.parent);
    // An unreachable store is not a verdict on the parent. Answering 400
    // unknown-parent for an outage tells a well-behaved client its request
    // was wrong and not to retry, when the honest answer is "ask again" —
    // the same store-unavailable 503 the job creation three lines below
    // already relays.
    if (parent.kind === "unavailable") {
      return refusal("store-unavailable", 503);
    }
    if (parent.kind === "absent" || parent.record.kind !== "link") {
      return refusal("unknown-parent", 400);
    }
  }

  // Opening a job costs the visitor nothing but occupies one of the four
  // concurrent custody slots — a ceiling shared with the paid archive route
  // — for a full quote expiry. Without a bound, a handful of tiny posts
  // could hold the whole pipeline at capacity indefinitely and deny every
  // genuine submission for free. The allowance is claimed here, after every
  // validation and before the price is fetched: only a request that would
  // really open a job spends one, and a refused request costs no upstream
  // call. Nothing in jobStore's capacity accounting changes, so the archive
  // path keeps exactly the protections it had.
  const slot = await claimSubmitSlot(clientAddress(req), Date.now());
  if (slot.kind === "throttled") {
    return NextResponse.json(
      { ok: false, reason: "too-many-submissions" },
      { status: 429, headers: { "retry-after": String(slot.retryAfterSeconds) } },
    );
  }

  // The exact bytes the worker will inscribe — encodeRecord is the one
  // encoder (A1), so the priced bytes, the content hash, and the eventual
  // OP_RETURN can never disagree.
  const recordBytes = encodeRecord(record);
  const quoted = quoteLink(recordBytes.length, await gbpPerBsv());
  if (!quoted) {
    return refusal("price-unavailable", 503);
  }

  const contentHash = Utils.toHex(Hash.sha256(Array.from(recordBytes)));
  const created = await createJob(
    { kind: "folklore", handle: "", contentHash, archive: record },
    quoted,
    Date.now(),
  );
  if (!created.ok) {
    return refusal(created.refused, 503);
  }

  return NextResponse.json({
    jobId: created.job.jobId,
    priceSats: created.job.priceSats,
    feeSats: created.job.feeSats,
    floorSats: quoted.premiumSats,
    expiresAtMs: created.job.expiresAtMs,
  });
}
