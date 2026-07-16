import { NextResponse } from "next/server";
import { getJob } from "@/lib/folkloreJob/jobStore";

/**
 * GET /api/folklore/job/[id]
 *
 * The visitor's own poll for a job's progress: state, price, and whichever
 * transaction ids or addresses exist so far. Never the archive payload and
 * never key material — those never leave the worker.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const job = await getJob(id);
  if (!job) {
    return NextResponse.json({ ok: false, reason: "not-found" }, { status: 404 });
  }

  return NextResponse.json({
    state: job.state,
    feeSats: job.feeSats,
    premiumSats: job.premiumSats,
    priceSats: job.priceSats,
    ...(job.address ? { address: job.address } : {}),
    ...(job.inscriptionTxid ? { inscriptionTxid: job.inscriptionTxid } : {}),
    ...(job.sweepTxid ? { sweepTxid: job.sweepTxid } : {}),
    ...(job.failureReason ? { failureReason: job.failureReason } : {}),
  });
}
