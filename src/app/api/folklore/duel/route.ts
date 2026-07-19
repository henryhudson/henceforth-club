import { NextResponse } from "next/server";
import { authenticateBearer } from "@/lib/kudos/auth";
import { isOwnWork, OWN_WORK_LINE } from "@/lib/kudos/ownWork";
import { listDealCandidates } from "@/lib/kudos/candidates";
import { appendDuel, readRatingTable } from "@/lib/kudos/ledger";
import {
  consumePairToken,
  dealPair,
  issuePairToken,
  markPairResolved,
  readResolvedPair,
  type DealtPairRecord,
  type DealtSide,
} from "@/lib/kudos/dealer";
import { accrueEarned, debitForDuel } from "@/lib/kudos/float";
import { recordTip } from "@/lib/kudos/tips";
import { getArchivePost } from "@/lib/xArchiveCache";
import { dateKey } from "@/lib/redis";

function refusal(reason: string, status: number) {
  return NextResponse.json({ ok: false, reason }, { status });
}

/** The self-kudos arm: refused with the friendly line, and nothing moves. */
function ownWorkRefusal() {
  return NextResponse.json(
    { ok: false, reason: "own-work", line: OWN_WORK_LINE },
    { status: 403 },
  );
}

/** A kudos amount from the wire: a positive safe integer or nothing. */
function parsedAmount(value: unknown): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 1
    ? value
    : null;
}

/** Media the arena can render on a side — same shape as archive posts. */
type WireMedia = { type: string; url: string; preview?: string };

/** One side as the arena renders it: the dealt side plus text and optional
 * media from the archive cache — empty when the cache cannot say, so a deal
 * never fails over display data. */
type WireSide = DealtSide & { text: string; media?: WireMedia[] };

/** What a deal looks like on the wire: the single-use token and the two
 * dealt sides, in stack order. */
type WireDeal = { token: string; pair: [WireSide, WireSide] };

async function hydratedSide(side: DealtSide): Promise<WireSide> {
  const post = await getArchivePost(side.author, side.postId);
  const media = post?.media?.filter((m) => m.url.length > 0);
  return {
    ...side,
    text: post?.text ?? "",
    ...(media && media.length > 0 ? { media } : {}),
  };
}

type NextDeal =
  | { kind: "dealt"; deal: WireDeal }
  | { kind: "none" }
  | { kind: "unavailable" };

/**
 * Deal the bearer's next pair: fold the current table, assemble the pool,
 * let the dealer choose, and bind the pair to the bearer under a single-use
 * token. `none` when the pool cannot put up two posts — the arena shows its
 * empty state rather than an error.
 */
async function dealNext(profile: string): Promise<NextDeal> {
  const [table, candidates] = await Promise.all([
    readRatingTable(),
    listDealCandidates(),
  ]);
  const dealt = dealPair(table, candidates, Math.random);
  if (dealt.kind !== "dealt") return { kind: "none" };

  const [a, b] = dealt.pair;
  const record: DealtPairRecord = {
    profile,
    a: { postId: a.postId, author: a.author },
    b: { postId: b.postId, author: b.author },
  };
  const issued = await issuePairToken(record);
  if (issued.kind !== "issued") return { kind: "unavailable" };
  const [sideA, sideB] = await Promise.all([hydratedSide(record.a), hydratedSide(record.b)]);
  return {
    kind: "dealt",
    deal: { token: issued.token, pair: [sideA, sideB] },
  };
}

/**
 * GET /api/folklore/duel — the deal. The pair is server-dealt, never chosen:
 * the response's token is the only door to resolving it, and it is bound to
 * the bearer it was dealt to.
 */
export async function GET(req: Request) {
  if (process.env.KUDOS_ENABLED !== "true") {
    return refusal("not-available", 503);
  }

  const auth = await authenticateBearer(req);
  if (auth.kind === "unavailable") return refusal("unavailable", 503);
  if (auth.kind !== "authenticated") return refusal(auth.kind, 401);

  const next = await dealNext(auth.profile);
  if (next.kind === "unavailable") return refusal("unavailable", 503);
  return NextResponse.json({ ok: true, deal: next.kind === "dealt" ? next.deal : null });
}

/**
 * POST /api/folklore/duel  { token, winnerPostId, amount }
 *
 * The kudos gesture crowns the dealt pair: debit the amount, append ONE
 * binary duel entry (the amount is generosity — the rating swing never sees
 * it), accrue the amount to the winner's author, and deal the next pair in
 * the same response.
 *
 * A stale token — the pair already resolved by the first kudos in the beat —
 * degrades to a tip on whichever side the kudos chose, the loser's applause
 * included; never a second duel. The resolved-pair record that makes this
 * possible lives exactly as long as the token would have.
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
  const { token, winnerPostId, amount } = (body ?? {}) as Record<string, unknown>;
  const kudos = parsedAmount(amount);
  if (
    typeof token !== "string" ||
    token.length === 0 ||
    typeof winnerPostId !== "string" ||
    winnerPostId.length === 0 ||
    kudos === null
  ) {
    return refusal("bad-input", 400);
  }

  const day = dateKey();
  const consumed = await consumePairToken(token, auth.profile);
  if (consumed.kind === "unavailable") return refusal("unavailable", 503);
  if (consumed.kind === "mismatch") return refusal("not-yours", 403);
  if (consumed.kind === "refused") {
    return degradeToTip(token, winnerPostId, kudos, auth.profile, day);
  }

  const { pair } = consumed;
  const winner = [pair.a, pair.b].find((side) => side.postId === winnerPostId);
  if (winner === undefined) {
    // The token burned on consumption, so the mistaken (or probing) request
    // costs the bearer their deal — but it never buys an arbitrary payout.
    return refusal("not-in-pair", 400);
  }
  const loser = winner === pair.a ? pair.b : pair.a;

  // Crowning your own text is refused before any money moves. The token
  // burned on consumption — the self-crown costs the bearer their deal, but
  // never a kudos and never a duel entry. Crowning the OPPONENT of your own
  // text stands: that duel pays someone else and your text loses it.
  if (isOwnWork(auth.profile, winner.author)) {
    return ownWorkRefusal();
  }

  const debit = await debitForDuel(auth.profile, kudos, day);
  switch (debit.kind) {
    case "capped":
      return refusal("daily-cap", 429);
    case "insufficient":
      return NextResponse.json(
        { ok: false, reason: "insufficient-float", float: debit.float },
        { status: 402 },
      );
    case "invalid":
      return refusal("bad-input", 400);
    case "unavailable":
      return refusal("unavailable", 503);
    case "recorded":
      break;
  }

  // Debit then record, per the float module's contract: the money is out,
  // now the bookkeeping — one binary duel entry (the token doubles as the
  // duel id, so a correction can name it), the amount to the winner's
  // author, and the resolved-pair marker that lets follow-up taps degrade
  // to tips.
  await appendDuel({
    duelId: token,
    winnerPostId: winner.postId,
    loserPostId: loser.postId,
    day,
  });
  await accrueEarned(winner.author, kudos);
  await markPairResolved(token, pair);

  const next = await dealNext(auth.profile);
  return NextResponse.json({
    ok: true,
    kind: "duel",
    float: debit.float,
    next: next.kind === "dealt" ? next.deal : null,
  });
}

/** The stale-token arm: kudos for an already-resolved pair become a tip on
 * the chosen side — never a second duel entry. */
async function degradeToTip(
  token: string,
  postId: string,
  kudos: number,
  profile: string,
  day: string,
) {
  const resolved = await readResolvedPair(token);
  if (resolved === null) return refusal("stale-token", 410);
  if (resolved.profile.toLowerCase() !== profile.toLowerCase()) {
    return refusal("not-yours", 403);
  }
  const side = [resolved.a, resolved.b].find((s) => s.postId === postId);
  if (side === undefined) return refusal("not-in-pair", 400);
  if (isOwnWork(profile, side.author)) return ownWorkRefusal();

  const tip = await recordTip(profile, side.postId, side.author, kudos, day);
  switch (tip.kind) {
    case "recorded":
      return NextResponse.json({ ok: true, kind: "tip", float: tip.float, tipped: tip.tipped });
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
