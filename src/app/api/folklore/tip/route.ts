import { NextResponse } from "next/server";
import { authenticateBearer } from "@/lib/kudos/auth";
import { isOwnWork, OWN_WORK_LINE } from "@/lib/kudos/ownWork";
import { getArchivePost } from "@/lib/xArchiveCache";
import { isBoardLink, readLinkRecord } from "@/lib/folkloreBoard";
import { sameBoundIdentity } from "@/lib/xOwner";
import { recordTip } from "@/lib/kudos/tips";
import { dateKey } from "@/lib/redis";

/** A board link is addressed by its inscription txid. Checking the shape
 * before asking the board keeps an ordinary archive post id — an X snowflake,
 * never 64 hex — off the board lookup entirely. */
const TXID_PATTERN = /^[0-9a-f]{64}$/;

function refusal(reason: string, status: number) {
  return NextResponse.json({ ok: false, reason }, { status });
}

/**
 * Does this tip's claimed recipient really own the named target?
 *
 * Two kinds of target, one rule: kudos reach the text's real author, so the
 * target's own record — never the request — decides who is paid.
 *
 *   archive post  the post must sit in that handle's archive
 *   board link    the link's own `by` must be that handle
 *
 * An anonymous link (no bound handle) names no recipient at all and so can
 * never match: debiting a giver with nothing to accrue against would put a
 * kudos outside the float module's conservation invariant, which is the one
 * thing that module exists to hold. Both misses answer the same `not-found`
 * — the target does not belong to the handle being paid.
 */
async function targetBelongsToHandle(postId: string, handle: string): Promise<
  { kind: "yes" } | { kind: "no" } | { kind: "unavailable" }
> {
  if (!TXID_PATTERN.test(postId) || !(await isBoardLink(postId))) {
    return (await getArchivePost(handle, postId)) === null ? { kind: "no" } : { kind: "yes" };
  }
  const read = await readLinkRecord(postId);
  if (read.kind === "unavailable") return { kind: "unavailable" };
  if (read.kind === "absent" || read.record.kind !== "link") return { kind: "no" };
  const submitter = read.record.by;
  return submitter !== undefined && submitter.toLowerCase() === handle.toLowerCase()
    ? { kind: "yes" }
    : { kind: "no" };
}

/** A kudos amount from the wire: a positive safe integer or nothing. */
function parsedAmount(value: unknown): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 1
    ? value
    : null;
}

/**
 * POST /api/folklore/tip  { handle, postId, amount }
 *
 * An in-feed tip: the bearer's float debits, the post's public count ticks,
 * the author's earnings accrue, the post's dealer priority bumps — and Elo
 * never moves (the tip module holds that line structurally). The target must
 * actually belong to the named handle: kudos only ever reach the text's real
 * author, so a tip cannot pump something's public count while routing the
 * money somewhere else.
 *
 * `postId` names either an archived post or — since the link board — a board
 * link's inscription txid, which is how a link's kudos reach its own card
 * (spec Decision 1: one board, links included). Comments are not board
 * entries and carry no kudos.
 */
export async function POST(req: Request) {
  if (process.env.KUDOS_ENABLED !== "true") {
    return refusal("not-available", 503);
  }

  const auth = await authenticateBearer(req);
  if (auth.kind === "unavailable") return refusal("unavailable", 503);
  if (auth.kind !== "authenticated") return refusal(auth.kind, 401);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return refusal("bad-input", 400);
  }
  const { handle, postId, amount } = (body ?? {}) as Record<string, unknown>;
  const kudos = parsedAmount(amount);
  if (
    typeof handle !== "string" ||
    !/^[A-Za-z0-9_]{1,15}$/.test(handle) ||
    typeof postId !== "string" ||
    postId.length === 0 ||
    kudos === null
  ) {
    return refusal("bad-input", 400);
  }

  // The handle names the receiving author; a payer tipping their own archive
  // — root or continuation post alike — is refused before anything is read
  // or debited.
  // Same name, or same person under two names. The handle match catches the
  // obvious case; the binding match catches the alt — a payer whose profile
  // and whose named recipient are two handles bound to ONE identity address
  // is tipping themselves, and would otherwise round-trip their own float
  // into a settleable accrual under a name the check could not see.
  // Unprovable is not refused: two handles with no shared binding are two
  // strangers as far as any evidence goes, and an honest tip must go through.
  if (isOwnWork(auth.profile, handle) || (await sameBoundIdentity(auth.profile, handle))) {
    return NextResponse.json(
      { ok: false, reason: "own-work", line: OWN_WORK_LINE },
      { status: 403 },
    );
  }

  const belongs = await targetBelongsToHandle(postId, handle);
  if (belongs.kind === "unavailable") return refusal("unavailable", 503);
  if (belongs.kind === "no") return refusal("not-found", 404);

  const tip = await recordTip(auth.profile, postId, handle, kudos, dateKey());
  switch (tip.kind) {
    case "recorded":
      return NextResponse.json({ ok: true, float: tip.float, tipped: tip.tipped });
    case "insufficient":
      return NextResponse.json(
        { ok: false, reason: "insufficient-float", float: tip.float },
        { status: 402 },
      );
    case "invalid":
      return refusal("bad-input", 400);
    case "unavailable":
      return refusal("unavailable", 503);
  }
}
