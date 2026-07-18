import { NextResponse } from "next/server";
import { getJob } from "@/lib/folkloreJob/jobStore";
import { issueFloatOnCompletion } from "@/lib/folkloreJob/floatFunding";

/** The bearer cookie lives a year — the recovery string, shown once, is the
 * only other way back into a float, so the cookie errs long. */
const TOKEN_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

/**
 * GET /api/folklore/job/[id]
 *
 * The visitor's own poll for a job's progress: state, price, and whichever
 * transaction ids or addresses exist so far. Never the archive payload and
 * never key material — those never leave the worker.
 *
 * On a done job, and only while KUDOS_ENABLED is exactly "true" (read per
 * request — nothing kudos-shaped is reachable without it), the £2 leg funds
 * the buyer's kudos float: exactly once across all polls (the issue is
 * claimed atomically in the store), the response carries the recovery string
 * that first time and never again, and the bearer token rides along as a
 * cookie so this device is signed in without the string.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const job = await getJob(id);
  if (!job) {
    return NextResponse.json({ ok: false, reason: "not-found" }, { status: 404 });
  }

  const status = {
    state: job.state,
    feeSats: job.feeSats,
    premiumSats: job.premiumSats,
    priceSats: job.priceSats,
    ...(job.address ? { address: job.address } : {}),
    ...(job.inscriptionTxid ? { inscriptionTxid: job.inscriptionTxid } : {}),
    ...(job.sweepTxid ? { sweepTxid: job.sweepTxid } : {}),
    ...(job.failureReason ? { failureReason: job.failureReason } : {}),
  };

  if (job.state === "done" && process.env.KUDOS_ENABLED === "true") {
    const issued = await issueFloatOnCompletion(job);
    if (issued.kind === "issued") {
      const response = NextResponse.json({
        ...status,
        kudosFloat: { recoveryString: issued.token, kudos: issued.kudos },
      });
      response.cookies.set("kudos_token", issued.token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: TOKEN_COOKIE_MAX_AGE_SECONDS,
      });
      return response;
    }
    // already-issued, no-float-leg, unavailable: the plain status — the
    // recovery string is never shown a second time.
  }

  return NextResponse.json(status);
}
