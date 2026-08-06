import { NextResponse } from "next/server";
import { getXTxids } from "@/lib/xIndex";
import { resolveTxDigest } from "@/lib/xDigest";

/**
 * GET /api/x/archived?handle=<handle>
 *
 * The set of tweet IDs already archived on chain for a handle — unioned across all
 * of that handle's archive transactions. The app uses this to inscribe only the
 * DELTA (the tweets not yet on chain) instead of duplicating the whole profile.
 * Public data: a TXID and its posts are already public on the blockchain.
 */
export async function GET(req: Request) {
  const handle = new URL(req.url).searchParams
    .get("handle")
    ?.trim()
    .replace(/^@/, "");
  if (!handle || !/^[A-Za-z0-9_]{1,15}$/.test(handle)) {
    return NextResponse.json({ ok: false, reason: "bad-handle" }, { status: 400 });
  }

  const txids = await getXTxids(handle);
  const tweetIds = new Set<string>();
  // Posts whose MEDIA is already inscribed — the layers are independent: a post
  // archived text-only can still have its photos backfilled later, so the app
  // needs both sets to compute what a new archive would actually add.
  const mediaPostIds = new Set<string>();
  for (const txid of txids) {
    const digest = await resolveTxDigest(txid);
    if (!digest) {
      // Never present a partial union as authoritative. A dropped transaction
      // would make the app think its tweets are not yet on chain and inscribe
      // (and pay for) them a second time — better to refuse outright.
      return NextResponse.json(
        { ok: false, reason: "index-read-incomplete" },
        { status: 503 },
      );
    }
    for (const id of digest.tweetIds) tweetIds.add(id);
    for (const id of digest.mediaPostIds) mediaPostIds.add(id);
  }

  return NextResponse.json({
    ok: true,
    archived: txids.length > 0,
    txids,
    tweetIds: [...tweetIds],
    mediaPostIds: [...mediaPostIds],
    count: tweetIds.size,
  });
}
