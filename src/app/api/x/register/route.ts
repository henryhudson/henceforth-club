import { NextResponse } from "next/server";
import { fetchTxArchive } from "@/lib/whatsonchain";
import { setXTxid } from "@/lib/xIndex";

/**
 * POST /api/x/register  { handle, txid }
 *
 * Indexes handle -> root-TXID so /x/<handle> can read the profile from chain.
 * Holds no keys and no money — a TXID is already public. Verification keeps the
 * index honest: the txid's on-chain inscription must actually archive `handle`,
 * so nobody can point a handle at an unrelated transaction.
 */
export async function POST(req: Request) {
  let body: { handle?: string; txid?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, reason: "bad-json" }, { status: 400 });
  }

  const handle = body.handle?.trim().replace(/^@/, "");
  const txid = body.txid?.trim();
  if (!handle || !txid || !/^[0-9a-fA-F]{64}$/.test(txid)) {
    return NextResponse.json({ ok: false, reason: "bad-input" }, { status: 400 });
  }

  const archive = await fetchTxArchive(txid);
  if (!archive) {
    return NextResponse.json(
      { ok: false, reason: "no-archive-in-tx" },
      { status: 422 },
    );
  }
  if (archive.handle.toLowerCase() !== handle.toLowerCase()) {
    return NextResponse.json(
      { ok: false, reason: "handle-mismatch", onChain: archive.handle },
      { status: 422 },
    );
  }

  const stored = await setXTxid(handle, txid);
  if (!stored) {
    return NextResponse.json(
      { ok: false, reason: "index-unavailable" },
      { status: 503 },
    );
  }

  return NextResponse.json({
    ok: true,
    handle,
    txid,
    posts: archive.posts.length,
    url: `/x/${handle}`,
  });
}
