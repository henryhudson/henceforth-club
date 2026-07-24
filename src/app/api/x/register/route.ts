import { NextResponse, after } from "next/server";
import { fetchTxArchive } from "@/lib/whatsonchain";
import { warmArchiveCache } from "@/lib/xArchiveCache";
import { appendXTxid, setXTxids, stampHandle } from "@/lib/xIndex";
import { archiveDigest, setTxDigest } from "@/lib/xDigest";
import { getOwner, setOwner, claimOutcome, type XOwner } from "@/lib/xOwner";
import { seedProfileOnBoard } from "@/lib/folkloreBoard";
import { parseBindingAddress, postBindingAddress, registrationMessage, verifyClaim } from "@/lib/xBinding";
import { verifyBindingPost } from "@/lib/xBindingLive";
import { logRefusal } from "@/lib/xRefusalLog";

/**
 * POST /api/x/register  { handle, txid, address?, pubkey?, signature? }
 *
 * Indexes handle -> archive txids so /x/ reads the profile from chain.
 * Holds no keys and no money — a txid and a public key are already public.
 *
 * Unclaimed handle: open, as it has always been (anyone can archive anyone).
 * Claimed handle: only the owner's signature may extend it. The first valid
 * claim establishes ownership and resets the canonical feed to the owner's
 * archive, so a stranger's pre-claim inscription leaves the owner's feed (it
 * stays reachable by its own txid — nothing on Bitcoin is destroyed).
 *
 * CONTRACT WITH THE SHIPPED APP — how to pick a status for a NEW reason.
 * The app (xtextWord.swift, `xRegistrationOutcome`) classifies refusals by
 * reason first; a reason it has never heard of falls back to the status
 * band: 4xx = permanent (the registration is dropped from the app's durable
 * retry queue, forever), 5xx = transient (kept and replayed on the next run).
 * So choose the status for the app already on people's phones, not for HTTP
 * taste: a refusal that can heal with time (a lagging index, an unreachable
 * upstream) MUST ship as a 5xx, or every existing app permanently drops a
 * PAID registration the first time it meets it. Reasons naming broken
 * evidence (bad signature, wrong handle) are correctly 4xx. Two more legs of
 * the same contract: every non-200 return MUST name a reason (the app reads
 * a reasonless answer as "not this route" — a middlebox or the platform —
 * and retries it), and both 200 returns MUST carry `ok: true` (the app
 * requires that marker before it believes a success).
 */
export async function POST(req: Request) {
  let body: { handle?: string; txid?: string; address?: string; pubkey?: string; signature?: string };
  try {
    body = await req.json();
  } catch {
    return refused({}, { ok: false, reason: "bad-json" }, 400);
  }

  const handle = body.handle?.trim().replace(/^@/, "");
  const txid = body.txid?.trim();
  if (!handle || !txid || !/^[0-9a-fA-F]{64}$/.test(txid)) {
    return refused({ handle, txid }, { ok: false, reason: "bad-input" }, 400);
  }

  const archive = await fetchTxArchive(txid);
  if (!archive) {
    return refused({ handle, txid }, { ok: false, reason: "no-archive-in-tx" }, 422);
  }
  if (archive.handle.toLowerCase() !== handle.toLowerCase()) {
    return refused({ handle, txid }, { ok: false, reason: "handle-mismatch", onChain: archive.handle }, 422);
  }

  await setTxDigest(txid, archiveDigest(archive));

  const owner = await getOwner(handle);
  const hasClaim = Boolean(body.address && body.pubkey && body.signature);

  // A claimed handle may only be extended by a signed claim.
  if (owner && !hasClaim) {
    return refused({ handle, txid }, { ok: false, reason: "handle-claimed" }, 403);
  }

  if (hasClaim) {
    const address = body.address!.trim();
    const ok = verifyClaim({
      message: registrationMessage(handle, txid),
      signatureBase64: body.signature!,
      pubkeyHex: body.pubkey!,
      committedAddress: address,
    });
    if (!ok) {
      return refused({ handle, txid }, { ok: false, reason: "bad-signature" }, 403);
    }

    const outcome = claimOutcome(owner, address);
    if (outcome === "reject") {
      return refused({ handle, txid }, { ok: false, reason: "not-the-owner" }, 403);
    }
    if (outcome === "establish") {
      // The archive establishing ownership must itself carry the account's
      // commitment to this address — the binding evidence and the archive are
      // one transaction. A later append is covered by the owner's signature
      // alone; it need not repeat the binding tweet.
      if (parseBindingAddress(archive.posts) !== address) {
        return refused({ handle, txid }, { ok: false, reason: "no-binding-in-tx" }, 422);
      }
      // ...but the archive is written by whoever paid for the transaction, so
      // on its own it is the claimant's own testimony. Ownership turns on the
      // one thing only the account can do: put the binding line under its own
      // handle. Read it back off X, once, at the moment ownership is first
      // established. Runs last, so a network call happens only for a claim
      // that has already passed every cheap local check.
      const postId = bindingPostId(archive.posts, address);
      const live = await verifyBindingPost({ handle, postId, address });
      switch (live.kind) {
        case "not-found":
          return refused({ handle, txid }, { ok: false, reason: "binding-post-missing" }, 422);
        case "wrong-author":
          return refused({ handle, txid }, { ok: false, reason: "binding-post-not-by-handle" }, 422);
        case "no-binding":
          return refused({ handle, txid }, { ok: false, reason: "binding-post-lacks-address" }, 422);
        case "unreachable":
          return refused({ handle, txid }, { ok: false, reason: "x-unreachable" }, 503);
        case "verified":
          break;
      }
      const record: XOwner = {
        address,
        pubkey: body.pubkey!,
        boundAt: Math.floor(Date.now() / 1000),
        bindingTxid: txid,
        bindingPostId: postId,
      };
      // Reset the feed before recording the owner: if either write fails (no
      // Redis), the route returns 503 rather than a false success, and a retry
      // re-establishes cleanly because no owner was recorded to short-circuit it.
      if (!(await setXTxids(handle, [txid]))) {
        return refused({ handle, txid }, { ok: false, reason: "index-unavailable" }, 503);
      }
      await stampHandle(handle, Date.now()); // a claim that resets the feed is also a registration
      await seedProfileOnBoard(handle, 0); // and lands a board card — see below
      if (!(await setOwner(handle, record))) {
        return refused({ handle, txid }, { ok: false, reason: "index-unavailable" }, 503);
      }
      // Rebuild the page cache now, after the response, while this route has
      // just proved the transaction is fetchable — a page view must never be
      // the request that pays for the stitch.
      after(() => warmArchiveCache(handle));
      return NextResponse.json({ ok: true, handle, txid, verified: true, reset: true, url: `/x/${handle}` });
    }
    // outcome === "append": the established owner adds another of their archives.
  }

  const stored = await appendXTxid(handle, txid);
  if (!stored) {
    return refused({ handle, txid }, { ok: false, reason: "index-unavailable" }, 503);
  }
  await stampHandle(handle, Date.now());
  // A registration lands a board card as well as a directory stamp. Until
  // this line the board was populated only by a hand-run seed script, so a
  // handle archiving after that script last ran was permanently absent from
  // the board — and the front page switched wholesale to the board the moment
  // one paid link existed, which made the omission invisible-by-design rather
  // than merely stale. Both halves are paying customers losing a listing they
  // were delivered, so the board is now complete without a manual step.
  // `nx`-guarded inside, so re-registering never resets a score kudos moved.
  await seedProfileOnBoard(handle, 0);
  // Extend the page cache by this one new transaction now, after the response
  // — the registration just proved the transaction is fetchable, and a page
  // view must never be the request that pays for the stitch.
  after(() => warmArchiveCache(handle));
  return NextResponse.json({ ok: true, handle, txid, verified: Boolean(owner || hasClaim), posts: archive.posts.length, url: `/x/${handle}` });
}

/** Every refusal leaves the route through here: the response is exactly the
 *  NextResponse.json the call site always sent, and a durable record of it is
 *  written after the response (the route's own `after` pattern — a log write
 *  must never be the request that pays, or fails, the answer; `logRefusal`
 *  additionally never throws). */
function refused(
  request: { handle?: string; txid?: string },
  body: { ok: false; reason: string; onChain?: string },
  status: number,
) {
  after(() => logRefusal({
    at: Math.floor(Date.now() / 1000),
    handle: request.handle ?? "",
    txid: request.txid ?? "",
    reason: body.reason,
    status,
  }));
  return NextResponse.json(body, { status });
}

/** The id of the post that carries the binding line for `address`, for the permalink.
 *  Reads the line through the library predicate, so the post X is asked to confirm
 *  is the same post `parseBindingAddress` accepted — one definition, not two. */
function bindingPostId(posts: { id: string; text: string }[], address: string): string {
  return posts.find((p) => postBindingAddress(p.text) === address)?.id ?? "";
}
