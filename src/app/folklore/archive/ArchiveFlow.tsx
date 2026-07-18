"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { JobState } from "@/lib/folkloreJob/jobs";
import { dropFailureMessage, selectArchiveFiles } from "../dropZone";
import { parseArchive } from "../parseArchive";
import { buildExportZip } from "./buildExportZip";
import { canRequestPayment } from "./canRequestPayment";
import { jobRefusalMessage } from "./jobRefusalMessage";
import { statusCopy } from "./statusCopy";
import QuoteCard from "./QuoteCard";
import PaymentPanel from "./PaymentPanel";
import FileDropLabel from "../_components/FileDropLabel";

/** A few seconds' interval — frequent enough to feel live, not so frequent
 * it hammers the route while a visitor watches a payment confirm. */
const POLL_INTERVAL_MS = 4_000;

type QuoteResponse = {
  jobId: string;
  feeSats: number;
  premiumSats: number;
  floatSats: number;
  priceSats: number;
  kudosEnabled: boolean;
  claimedHandle: boolean;
  notice?: string;
};

/** The £2 leg landing as kudos on the done screen — present on exactly one
 * poll response, the first to see the job done; the server never sends the
 * recovery string twice, and never sends it at all while kudos are off. */
type KudosFloatGrant = {
  recoveryString: string;
  kudos: number;
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
  kudosFloat?: KudosFloatGrant;
};

export default function ArchiveFlow() {
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [handle, setHandle] = useState<string | null>(null);
  const [quote, setQuote] = useState<QuoteResponse | null>(null);
  const [status, setStatus] = useState<JobStatus | null>(null);
  const [permanenceChecked, setPermanenceChecked] = useState(false);
  const [ownAccountChecked, setOwnAccountChecked] = useState(false);
  const [floatGrant, setFloatGrant] = useState<KudosFloatGrant | null>(null);

  const jobId = quote?.jobId;
  const isTerminal = status?.state === "done" || status?.state === "swept";

  // Poll the job's status while it is live. Stops once the job reaches a
  // terminal state (done or swept) — polling a finished job forever would
  // just be wasted requests.
  useEffect(() => {
    if (!jobId || isTerminal) return;

    let active = true;
    async function poll() {
      try {
        const res = await fetch(`/api/folklore/job/${jobId}`);
        if (!res.ok) return; // transient — retried next tick
        const body = (await res.json()) as JobStatus;
        if (active) {
          setStatus(body);
          // The recovery string arrives on exactly one response; keep it in
          // state so the done screen can render it — once, never again after
          // this page is gone.
          if (body.kudosFloat) setFloatGrant(body.kudosFloat);
        }
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

  async function onFiles(list: FileList | null) {
    setError(null);
    const picked = selectArchiveFiles(list ? Array.from(list) : []);
    if (!picked.ok) {
      setError(dropFailureMessage(picked.reason));
      return;
    }

    let zipBytes: Uint8Array;
    let parsedHandle: string;
    try {
      const [tweetsText, profileText, accountText] = await Promise.all([
        picked.tweets.text(),
        picked.profile.text(),
        picked.account.text(),
      ]);
      parsedHandle = parseArchive(tweetsText, profileText, accountText).profile.handle;
      zipBytes = buildExportZip({
        tweets: new TextEncoder().encode(tweetsText),
        profile: new TextEncoder().encode(profileText),
        account: new TextEncoder().encode(accountText),
      });
    } catch {
      setError(dropFailureMessage("unparseable"));
      return;
    }

    setUploading(true);
    try {
      const form = new FormData();
      // fflate's zipSync returns a Uint8Array<ArrayBufferLike>; Blob's BlobPart
      // wants one backed by a concrete ArrayBuffer, hence the re-wrap.
      form.set("zip", new Blob([new Uint8Array(zipBytes)]), "export.zip");

      const res = await fetch("/api/folklore/job", { method: "POST", body: form });
      const body = await res.json();
      if (!res.ok) {
        setError(jobRefusalMessage(body?.reason));
        return;
      }

      const success = body as QuoteResponse;
      setHandle(parsedHandle);
      setQuote(success);
      setStatus({
        state: "quoted",
        feeSats: success.feeSats,
        premiumSats: success.premiumSats,
        priceSats: success.priceSats,
      });
    } catch {
      setError("Something went wrong sending your export. Nothing was charged — try again.");
    } finally {
      setUploading(false);
    }
  }

  if (!quote || !status) {
    return (
      <div className="mx-auto max-w-2xl px-6 pb-10">
        <FileDropLabel onFiles={onFiles} disabled={uploading}>
          {uploading ? (
            "Uploading…"
          ) : (
            <>
              Choose or drop{" "}
              <span className="text-foreground">tweets.js · profile.js · account.js</span>{" "}
              from the export X emailed you
              <span className="mt-1 block text-xs">
                Sent to us once, to inscribe for £2 plus the miner&rsquo;s fee. Nothing else leaves
                your browser.
              </span>
            </>
          )}
        </FileDropLabel>
        {error && <p className="mt-3 text-sm text-accent-orange">{error}</p>}
      </div>
    );
  }

  const view = statusCopy({
    state: status.state,
    handle: handle ?? "",
    failureReason: status.failureReason,
    sweepTxid: status.sweepTxid,
  });
  const readyToPay = canRequestPayment(permanenceChecked, ownAccountChecked);

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-6 pb-16">
      <QuoteCard priceSats={quote.priceSats} claimedNotice={quote.notice} kudosEnabled={quote.kudosEnabled} />

      <div className="space-y-3 rounded-2xl border border-card-border bg-card-bg p-6 text-sm">
        <label className="flex items-start gap-2">
          <input
            type="checkbox"
            className="mt-1"
            checked={permanenceChecked}
            onChange={(e) => setPermanenceChecked(e.target.checked)}
          />
          <span>Bitcoin is forever — this cannot be deleted.</span>
        </label>
        <label className="flex items-start gap-2">
          <input
            type="checkbox"
            className="mt-1"
            checked={ownAccountChecked}
            onChange={(e) => setOwnAccountChecked(e.target.checked)}
          />
          <span>This is my own account&rsquo;s export.</span>
        </label>
      </div>

      {readyToPay && status.address && <PaymentPanel address={status.address} priceSats={status.priceSats} />}
      {!readyToPay && status.address && (
        <p className="text-center text-sm text-muted">
          Confirm both boxes above to reveal your payment address.
        </p>
      )}

      <div className="rounded-2xl border border-card-border bg-card-bg p-6 text-center">
        <p className="font-semibold text-foreground">{view.heading}</p>
        <p className="mt-2 text-sm text-muted">{view.body}</p>
        {status.state === "done" && handle && (
          <Link href={`/folklore/${handle}`} className="mt-3 inline-block text-accent hover:underline">
            View your archive &rarr;
          </Link>
        )}
        {status.state === "done" && floatGrant && (
          <div className="mt-5 border-t border-card-border pt-5 text-left">
            <p className="font-semibold text-foreground">
              Your kudos float is funded &mdash; {floatGrant.kudos.toLocaleString("en-GB")} kudos to
              give to the writing you rate.
            </p>
            <p className="mt-2 text-sm text-muted">
              This browser is signed in already. Your recovery string, shown exactly once &mdash;
              save it now; it is the only way into your kudos from another device:
            </p>
            <p className="mt-2 select-all break-all rounded-lg border border-card-border bg-background p-3 font-mono text-sm text-foreground">
              {floatGrant.recoveryString}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
