import { NextResponse } from "next/server";
import { authenticateBearer } from "@/lib/kudos/auth";
import { isOwnWork, OWN_WORK_LINE } from "@/lib/kudos/ownWork";
import { getArchivePost } from "@/lib/xArchiveCache";
import { recordTip } from "@/lib/kudos/tips";
import { dateKey } from "@/lib/redis";

function refusal(reason: string, status: number) {
  return NextResponse.json({ ok: false, reason }, { status });
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
 * never moves (the tip module holds that line structurally). The post must
 * actually sit in the named handle's archive: kudos only ever reach the text's
 * real author, so a tip cannot pump a post's public count while routing the
 * money somewhere else.
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
  if (isOwnWork(auth.profile, handle)) {
    return NextResponse.json(
      { ok: false, reason: "own-work", line: OWN_WORK_LINE },
      { status: 403 },
    );
  }

  const post = await getArchivePost(handle, postId);
  if (post === null) return refusal("not-found", 404);

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
