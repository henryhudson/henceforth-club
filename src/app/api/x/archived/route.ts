import { NextResponse } from "next/server";
import { getXTxids } from "@/lib/xIndex";
import { fetchTxArchive } from "@/lib/whatsonchain";

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
  for (const txid of txids) {
    const archive = await fetchTxArchive(txid);
    if (archive) for (const post of archive.posts) tweetIds.add(post.id);
  }

  return NextResponse.json({
    ok: true,
    archived: txids.length > 0,
    txids,
    tweetIds: [...tweetIds],
    count: tweetIds.size,
  });
}
