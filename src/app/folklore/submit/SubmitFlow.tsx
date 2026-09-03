"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { JobState } from "@/lib/folkloreJob/jobs";
import { QUOTE_EXPIRY_MINUTES } from "@/lib/folkloreJob/constants";
import type { Preview } from "@/app/api/folklore/preview/preview";
import { REVENUE_ADDRESS } from "@/lib/revenueAddress";
import { extractTargetTxid } from "../extractTarget";
import { COMMENT_MAX, TITLE_MAX, validateLink, type FolkloreLink } from "../linkRecord";
import { shortTxid } from "../shortTxid";
import { sourceLabel } from "../tx/classify";
import { draftRequest, type SubmitDraft } from "./submitDraft";
import { submitRefusalMessage } from "./submitRefusalMessage";
import { submitStatusCopy } from "./submitStatusCopy";
import PaymentPanel from "../archive/PaymentPanel";

// Two rails under one form. A TARGET rides the cheap path (specification,
// Decision 4): paste an id, see what it is, give it a title, sign the stamp
// in Henceforth yourself, paste the stamp's id back, and the index lands the
// row — no job, no poller, no key on the site. A COMMENT still rides the
// custodial job rail exactly as before; only the link arm changed.

/** The archive flow's poll cadence — frequent enough to feel live, not so
 * frequent it hammers the route while a visitor watches a payment confirm. */
const POLL_INTERVAL_MS = 4_000;

type QuoteResponse = {
  jobId: string;
  priceSats: number;
  feeSats: number;
  floorSats: number;
  expiresAtMs: number;
};

type JobStatus = {
  state: JobState;
  feeSats: number;
  premiumSats: number;
  priceSats: number;
  address?: string;
  inscriptionTxid?: string;
  sweepTxid?: string;
  failureReason?: string;
};

/** What the form knows about the pasted id, from one read of the chain. */
type PreviewState =
  | { kind: "idle" }
  | { kind: "loading"; txid: string }
  | { kind: "ready"; preview: Preview }
  | { kind: "unknown"; txid: string }
  | { kind: "unreachable"; txid: string };

const inputClass =
  "mt-1 w-full rounded-xl border border-card-border bg-card-bg/50 px-4 py-3 text-foreground placeholder:text-muted/60 outline-none transition-colors focus:border-accent";
const buttonClass =
  "rounded-md border border-accent px-4 py-2 font-mono text-sm text-accent transition-colors hover:bg-accent hover:text-background disabled:opacity-50";

export default function SubmitFlow({
  floorPence,
  defaultParent,
}: {
  floorPence: number;
  defaultParent?: string;
}) {
  const [kind, setKind] = useState<"link" | "comment">(defaultParent ? "comment" : "link");
  const [target, setTarget] = useState("");
  const [title, setTitle] = useState("");
  const [parent, setParent] = useState(defaultParent ?? "");
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [requesting, setRequesting] = useState(false);
  // The route said "not-available": the flag went dark between this page
  // rendering and the request. The closed state replaces the form entirely —
  // never an error line under inputs that cannot work.
  const [closed, setClosed] = useState(false);

  // The target rail.
  const [previewState, setPreviewState] = useState<PreviewState>({ kind: "idle" });
  const [prepared, setPrepared] = useState<FolkloreLink | null>(null);
  const [stampTxid, setStampTxid] = useState("");
  const [indexing, setIndexing] = useState(false);
  const [indexed, setIndexed] = useState<{ target: string; stampTxid: string } | null>(null);
  const [listedAt, setListedAt] = useState<string | null>(null);

  // The comment rail.
  const [submitted, setSubmitted] = useState<SubmitDraft | null>(null);
  const [quote, setQuote] = useState<QuoteResponse | null>(null);
  const [status, setStatus] = useState<JobStatus | null>(null);
  const [permanenceChecked, setPermanenceChecked] = useState(false);

  const jobId = quote?.jobId;
  const isTerminal = status?.state === "done" || status?.state === "swept";

  // Preview whatever id the paste contains, once per distinct id: the read
  // is the same one the thread page makes, and it costs the visitor nothing.
  const pastedTarget = kind === "link" ? extractTargetTxid(target) : null;
  useEffect(() => {
    if (!pastedTarget) {
      setPreviewState({ kind: "idle" });
      return;
    }
    let active = true;
    setPreviewState({ kind: "loading", txid: pastedTarget });
    (async () => {
      try {
        const res = await fetch(`/api/folklore/preview?txid=${pastedTarget}`);
        if (!active) return;
        if (!res.ok) {
          setPreviewState({ kind: "unknown", txid: pastedTarget });
          return;
        }
        const preview = (await res.json()) as Preview;
        if (!active) return;
        setPreviewState({ kind: "ready", preview });
        // The default title is the parse's first line; a title the visitor
        // has already typed is theirs and is never overwritten.
        if (preview.title) {
          setTitle((current) => (current.trim().length === 0 ? preview.title ?? "" : current));
        }
      } catch {
        if (active) setPreviewState({ kind: "unreachable", txid: pastedTarget });
      }
    })();
    return () => {
      active = false;
    };
  }, [pastedTarget]);

  // Poll a comment job while it is live; stop at a terminal state — polling
  // a finished job forever would just be wasted requests.
  useEffect(() => {
    if (!jobId || isTerminal) return;

    let active = true;
    async function poll() {
      try {
        const res = await fetch(`/api/folklore/job/${jobId}`);
        if (!res.ok) return; // transient — retried next tick
        const body = (await res.json()) as JobStatus;
        if (active) setStatus(body);
      } catch {
        // a flaky fetch just leaves the last known status in place
      }
    }

    const id = setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, [jobId, isTerminal]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const draft: SubmitDraft = kind === "link" ? { kind, target, title } : { kind, parent, text };
    const checked = draftRequest(draft);
    if (!checked.ok) {
      setError(checked.message);
      return;
    }

    // A target needs no request: the stamp is the visitor's to sign. The
    // record shown is the exact bytes the index will read back off the chain.
    if (checked.body.kind === "link") {
      const record = validateLink(checked.body.target, checked.body.title);
      if (!record) {
        setError("That listing cannot be submitted.");
        return;
      }
      setPrepared(record);
      return;
    }

    setRequesting(true);
    try {
      const res = await fetch("/api/folklore/link", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(checked.body),
      });
      const body = await res.json();
      if (!res.ok) {
        if (body?.reason === "not-available") {
          setClosed(true);
          return;
        }
        const retryAfterHeader = res.headers.get("retry-after");
        setError(
          submitRefusalMessage(
            body?.reason,
            retryAfterHeader === null ? undefined : Number(retryAfterHeader),
          ),
        );
        return;
      }

      const quoted = body as QuoteResponse;
      setSubmitted(checked.body);
      setQuote(quoted);
      setStatus({
        state: "quoted",
        feeSats: quoted.feeSats,
        premiumSats: quoted.floorSats,
        priceSats: quoted.priceSats,
      });
    } catch {
      setError("Something went wrong submitting. Nothing was charged — try again.");
    } finally {
      setRequesting(false);
    }
  }

  async function onIndex(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setListedAt(null);

    const stamp = extractTargetTxid(stampTxid);
    if (!stamp) {
      setError("Paste the stamp's transaction id — 64 hex characters.");
      return;
    }

    setIndexing(true);
    try {
      const res = await fetch("/api/folklore/index", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ stampTxid: stamp }),
      });
      const body = await res.json();
      if (!res.ok) {
        if (body?.reason === "not-available") {
          setClosed(true);
          return;
        }
        if (body?.reason === "already-listed" && typeof body.target === "string") {
          setListedAt(body.target);
        }
        setError(submitRefusalMessage(body?.reason));
        return;
      }
      setIndexed({ target: String(body.target), stampTxid: String(body.stampTxid) });
    } catch {
      setError(
        "Something went wrong indexing. If you broadcast the stamp, it is on chain — index it again in a moment.",
      );
    } finally {
      setIndexing(false);
    }
  }

  if (closed) {
    return (
      <div className="mx-auto max-w-2xl px-6 pb-16 text-center">
        <p className="font-semibold text-foreground">Submissions are not open yet.</p>
        <p className="mt-2 text-sm text-muted">
          The board is live to read; the submit path opens after its first funded end-to-end run.
          Nothing was sent and nothing was charged.
        </p>
        <Link href="/folklore" className="mt-4 inline-block text-accent hover:underline">
          &larr; Back to the board
        </Link>
      </div>
    );
  }

  if (indexed) {
    return (
      <div className="mx-auto max-w-2xl space-y-6 px-6 pb-16">
        <div className="rounded-2xl border border-card-border bg-card-bg p-6 text-center">
          <p className="font-semibold text-foreground">On the board</p>
          <p className="mt-2 text-sm text-muted">
            {shortTxid(indexed.target)} is listed. Its stamp, {shortTxid(indexed.stampTxid)}, is on
            chain for good.
          </p>
          <Link
            href={`/folklore/tx/${indexed.target}`}
            className="mt-3 inline-block text-accent hover:underline"
          >
            View the thread →
          </Link>
        </div>
      </div>
    );
  }

  if (prepared) {
    const payload = JSON.stringify(prepared);
    const preparedTarget = prepared.txid ?? "";
    return (
      <div className="mx-auto max-w-2xl space-y-6 px-6 pb-16">
        <div className="rounded-2xl border border-card-border bg-card-bg p-6">
          <p className="ledger-label">Sign the stamp in Henceforth</p>
          <p className="mt-3 text-sm text-muted">
            The stamp is one transaction of yours with two outputs: this record, byte for byte, in
            an OP_RETURN, and a payment of at least the {floorPence}p floor to the revenue address.
            Henceforth prices the floor at the live rate when you sign; the miner&rsquo;s fee is
            yours. The site never holds a key.
          </p>
          <p className="mt-4 text-xs text-muted">The record</p>
          <pre className="mt-1 overflow-x-auto rounded-xl border border-card-border bg-background px-4 py-3 font-mono text-[12px] text-foreground">
            {payload}
          </pre>
          <p className="mt-4 text-xs text-muted">The revenue address</p>
          <code className="mt-1 block break-all font-mono text-sm text-foreground">
            {REVENUE_ADDRESS}
          </code>
          <p className="mt-4 text-sm text-muted">
            Bitcoin is forever — the stamp cannot be edited or deleted once broadcast.
          </p>
          <button
            type="button"
            onClick={() => {
              setPrepared(null);
              setError(null);
              setListedAt(null);
            }}
            className="mt-4 font-mono text-xs text-muted transition-colors hover:text-accent hover:underline"
          >
            &larr; Change the target or the title
          </button>
        </div>

        <form
          onSubmit={onIndex}
          noValidate
          className="space-y-4 rounded-2xl border border-card-border bg-card-bg p-6"
        >
          <p className="ledger-label">I&rsquo;ve broadcast</p>
          <div>
            <label htmlFor="submit-stamp" className="block text-sm text-muted">
              The stamp&rsquo;s transaction id &middot; 64 hex characters
            </label>
            <input
              id="submit-stamp"
              type="text"
              value={stampTxid}
              onChange={(e) => setStampTxid(e.target.value)}
              spellCheck={false}
              className={`${inputClass} font-mono`}
            />
          </div>
          {error && (
            <p role="alert" className="text-sm text-accent-orange">
              {error}
              {listedAt && (
                <>
                  {" "}
                  <Link href={`/folklore/tx/${listedAt}`} className="underline">
                    Open the existing thread →
                  </Link>
                </>
              )}
            </p>
          )}
          <button type="submit" disabled={indexing} className={buttonClass}>
            {indexing ? "Indexing…" : `Index it — list ${shortTxid(preparedTarget)} on the board`}
          </button>
          <p className="text-xs text-muted">
            The index reads your stamp back off the chain and checks the floor. If the store is
            away, the stamp still stands — index it again later.
          </p>
        </form>
      </div>
    );
  }

  if (!quote || !status || !submitted) {
    return (
      <form onSubmit={onSubmit} noValidate className="mx-auto max-w-2xl space-y-5 px-6 pb-16">
        <fieldset>
          <legend className="ledger-label">What are you submitting?</legend>
          <div className="mt-3 flex gap-6 text-sm text-foreground">
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="kind"
                value="link"
                checked={kind === "link"}
                onChange={() => setKind("link")}
              />
              A transaction id
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="kind"
                value="comment"
                checked={kind === "comment"}
                onChange={() => setKind("comment")}
              />
              A comment
            </label>
          </div>
        </fieldset>

        {kind === "link" ? (
          <>
            <div>
              <label htmlFor="submit-target" className="block text-sm text-muted">
                Paste a transaction id &middot; or a link that contains one
              </label>
              <input
                id="submit-target"
                type="text"
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                placeholder="64 hex characters — a Twetch, Treechat or explorer link works too"
                spellCheck={false}
                className={`${inputClass} font-mono`}
              />
            </div>
            <PreviewCard state={previewState} onListInstead={(id) => setTarget(id)} />
            <div>
              <label htmlFor="submit-title" className="block text-sm text-muted">
                Title &middot; up to {TITLE_MAX} characters
              </label>
              <input
                id="submit-title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className={inputClass}
              />
            </div>
          </>
        ) : (
          <>
            <div>
              <label htmlFor="submit-parent" className="block text-sm text-muted">
                The link&rsquo;s transaction id &middot; 64 hex characters
              </label>
              <input
                id="submit-parent"
                type="text"
                value={parent}
                onChange={(e) => setParent(e.target.value)}
                spellCheck={false}
                className={`${inputClass} font-mono`}
              />
            </div>
            <div>
              <label htmlFor="submit-text" className="block text-sm text-muted">
                Your comment &middot; up to {COMMENT_MAX.toLocaleString("en-GB")} characters
              </label>
              <textarea
                id="submit-text"
                rows={6}
                value={text}
                onChange={(e) => setText(e.target.value)}
                className={inputClass}
              />
            </div>
          </>
        )}

        {error && (
          <p role="alert" className="text-sm text-accent-orange">
            {error}
          </p>
        )}

        {kind === "link" ? (
          <>
            <button type="submit" className={buttonClass}>
              Prepare the stamp — {floorPence}p + the miner&rsquo;s fee
            </button>
            <p className="text-xs text-muted">
              Nothing is written to Bitcoin until you sign and broadcast the stamp yourself.
            </p>
          </>
        ) : (
          <>
            <button type="submit" disabled={requesting} className={buttonClass}>
              {requesting ? "Quoting…" : `Get the quote — ${floorPence}p + the inscription fee`}
            </button>
            <p className="text-xs text-muted">
              The quote is free, and nothing is written to Bitcoin until you pay it.
            </p>
          </>
        )}
      </form>
    );
  }

  const view = submitStatusCopy({
    state: status.state,
    kind: submitted.kind,
    failureReason: status.failureReason,
    sweepTxid: status.sweepTxid,
  });
  const priceLabel = `${floorPence}p + inscription fee`;
  const doneHref =
    submitted.kind === "comment"
      ? `/folklore/tx/${submitted.parent}`
      : status.inscriptionTxid
        ? `/folklore/tx/${status.inscriptionTxid}`
        : "/folklore";
  const n = (v: number) => v.toLocaleString("en-GB");

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-6 pb-16">
      <div className="rounded-2xl border border-card-border bg-card-bg p-6">
        <div className="flex items-baseline justify-between gap-4">
          <span className="text-sm text-muted">Price</span>
          <span className="text-right text-lg font-bold text-foreground">
            {priceLabel}{" "}
            <span className="text-sm font-normal text-muted">
              &middot; {n(quote.priceSats)} satoshis at the live rate
            </span>
          </span>
        </div>
        <p className="mt-3 text-sm text-muted">
          {n(quote.floorSats)} satoshis is the {floorPence}p floor that deters spam;{" "}
          {n(quote.feeSats)} satoshis is the miner&rsquo;s fee for the inscription itself. The quote
          holds for {QUOTE_EXPIRY_MINUTES} minutes.
        </p>
      </div>

      <div className="rounded-2xl border border-card-border bg-card-bg p-6 text-sm">
        <label className="flex items-start gap-2">
          <input
            type="checkbox"
            className="mt-1"
            checked={permanenceChecked}
            onChange={(e) => setPermanenceChecked(e.target.checked)}
          />
          <span>Bitcoin is forever — this cannot be edited or deleted.</span>
        </label>
      </div>

      {permanenceChecked && status.address && (
        <PaymentPanel address={status.address} priceSats={status.priceSats} priceLabel={priceLabel} />
      )}
      {!permanenceChecked && status.address && (
        <p className="text-center text-sm text-muted">
          Confirm the box above to reveal your payment address.
        </p>
      )}

      <div className="rounded-2xl border border-card-border bg-card-bg p-6 text-center">
        <p className="font-semibold text-foreground">{view.heading}</p>
        <p className="mt-2 text-sm text-muted">{view.body}</p>
        {status.state === "done" && (
          <Link href={doneHref} className="mt-3 inline-block text-accent hover:underline">
            {submitted.kind === "link" ? "View it on the board →" : "View the thread →"}
          </Link>
        )}
      </div>
    </div>
  );
}

/** What the pasted id is, from the preview read: a chip and a default title
 * for a post or an archive; an honest "on Bitcoin" for an id nothing here
 * can render (still listable); and, for a comment or a stamp, the one id
 * that carries the thread, offered in the paste's place. */
function PreviewCard({
  state,
  onListInstead,
}: {
  state: PreviewState;
  onListInstead: (txid: string) => void;
}) {
  if (state.kind === "idle") return null;
  if (state.kind === "loading") {
    return <p className="text-sm text-muted">Reading {shortTxid(state.txid)} from the chain…</p>;
  }
  if (state.kind === "unknown") {
    return (
      <p className="text-sm text-muted">
        {shortTxid(state.txid)} can&rsquo;t be read from the chain yet. If it was just broadcast,
        give it a moment. You can still prepare the stamp.
      </p>
    );
  }
  if (state.kind === "unreachable") {
    return (
      <p className="text-sm text-muted">
        The chain couldn&rsquo;t be reached to preview {shortTxid(state.txid)}. You can still
        prepare the stamp.
      </p>
    );
  }
  const { preview } = state;
  if (preview.listInstead) {
    const instead = preview.listInstead;
    return (
      <div className="rounded-2xl border border-card-border bg-card-bg p-5 text-sm">
        <p className="text-foreground">
          {shortTxid(preview.txid)} is {preview.kind === "comment" ? "a comment under" : "a stamp of"}{" "}
          {shortTxid(instead)}. An id has one thread, and it is the target&rsquo;s.
        </p>
        <button
          type="button"
          onClick={() => onListInstead(instead)}
          className="mt-3 font-mono text-xs text-accent hover:underline"
        >
          List {shortTxid(instead)} instead →
        </button>
      </div>
    );
  }
  return (
    <div className="rounded-2xl border border-card-border bg-card-bg p-5">
      <p className="ledger-label">
        {preview.source ? sourceLabel(preview.source) : "On Bitcoin — not a post we can render"}
      </p>
      {preview.title && <p className="mt-2 font-semibold text-foreground">{preview.title}</p>}
      <p className="mt-1 font-mono text-[11px] text-muted">
        {shortTxid(preview.txid)} &middot;{" "}
        <a
          href={`/folklore/tx/${preview.txid}`}
          target="_blank"
          rel="noopener noreferrer"
          className="transition-colors hover:text-accent hover:underline"
        >
          open the thread ↗
        </a>
      </p>
    </div>
  );
}
