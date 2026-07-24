"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { JobState } from "@/lib/folkloreJob/jobs";
import { QUOTE_EXPIRY_MINUTES } from "@/lib/folkloreJob/constants";
import { COMMENT_MAX, TITLE_MAX } from "../linkRecord";
import { draftRequest, type SubmitDraft } from "./submitDraft";
import { submitRefusalMessage } from "./submitRefusalMessage";
import { submitStatusCopy } from "./submitStatusCopy";
import PaymentPanel from "../archive/PaymentPanel";

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

const inputClass =
  "mt-1 w-full rounded-xl border border-card-border bg-card-bg/50 px-4 py-3 text-foreground placeholder:text-muted/60 outline-none transition-colors focus:border-accent";

export default function SubmitFlow({
  floorPence,
  defaultParent,
}: {
  floorPence: number;
  defaultParent?: string;
}) {
  const [kind, setKind] = useState<"link" | "comment">(defaultParent ? "comment" : "link");
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [parent, setParent] = useState(defaultParent ?? "");
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [requesting, setRequesting] = useState(false);
  // The route said "not-available": the flag went dark between this page
  // rendering and the request. The closed state replaces the form entirely —
  // never an error line under inputs that cannot work.
  const [closed, setClosed] = useState(false);
  const [submitted, setSubmitted] = useState<SubmitDraft | null>(null);
  const [quote, setQuote] = useState<QuoteResponse | null>(null);
  const [status, setStatus] = useState<JobStatus | null>(null);
  const [permanenceChecked, setPermanenceChecked] = useState(false);

  const jobId = quote?.jobId;
  const isTerminal = status?.state === "done" || status?.state === "swept";

  // Poll the job while it is live; stop at a terminal state — polling a
  // finished job forever would just be wasted requests.
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

    const draft: SubmitDraft = kind === "link" ? { kind, url, title } : { kind, parent, text };
    const checked = draftRequest(draft);
    if (!checked.ok) {
      setError(checked.message);
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
              A link
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
              <label htmlFor="submit-url" className="block text-sm text-muted">
                The link &middot; http or https
              </label>
              <input
                id="submit-url"
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://…"
                spellCheck={false}
                className={inputClass}
              />
            </div>
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

        <button
          type="submit"
          disabled={requesting}
          className="rounded-md border border-accent px-4 py-2 font-mono text-sm text-accent transition-colors hover:bg-accent hover:text-background disabled:opacity-50"
        >
          {requesting ? "Quoting…" : `Get the quote — ${floorPence}p + the inscription fee`}
        </button>
        <p className="text-xs text-muted">
          The quote is free, and nothing is written to Bitcoin until you pay it.
        </p>
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
