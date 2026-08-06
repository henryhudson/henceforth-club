import { NextResponse } from "next/server";
import { fetchProfileHead, fetchXArchive } from "@/lib/xfetch";
import { payAndReserve, RESOURCES_TEXT_ONLY } from "@/lib/xGate";

/**
 * GET /api/x/fetch?handle=<h>&payment=<txid>
 *
 * The shared-token fetch: the X bearer token lives ONLY here (env var
 * X_BEARER_TOKEN), never in the app, so every user can archive a profile
 * without configuring anything.
 *
 * Every call spends real money — X bills per resource returned — and the money is
 * the operator's. So a call must arrive with a `payment`: the id of a transaction
 * that already paid the archive reward address. We verify it on chain, burn it so
 * it buys exactly one read, and reserve the call's worst-case cost against a hard
 * daily budget. Only then do we talk to X.
 *
 * Until 2026-07-08 this endpoint was public and unauthenticated, paged the whole
 * 3,200-post timeline, and was guarded only by ten requests per network address
 * per hour — a guard that vanished entirely when Redis was unreachable, because
 * it was written as `if (redis)`. Anyone could spend the operator's balance and
 * pay nothing.
 */
export async function GET(req: Request) {
  const token = process.env.X_BEARER_TOKEN;
  if (!token) {
    return NextResponse.json({ ok: false, reason: "server-token-unset" }, { status: 503 });
  }

  const params = new URL(req.url).searchParams;
  const handle = params.get("handle")?.trim().replace(/^@/, "") ?? "";
  if (!/^[A-Za-z0-9_]{1,15}$/.test(handle)) {
    return NextResponse.json({ ok: false, reason: "bad-handle" }, { status: 400 });
  }

  const gate = await payAndReserve(params.get("payment"), RESOURCES_TEXT_ONLY);
  if (!gate.ok) return gate.response;

  // The head is read here and handed to `fetchXArchive`, which takes it as an
  // argument precisely so it cannot read it again (2026-08-06). One head plus
  // one page — the exact read RESOURCES_TEXT_ONLY reserved above.
  const head = await fetchProfileHead(handle, token);
  if (!head) {
    return NextResponse.json({ ok: false, reason: "no-user" }, { status: 404 });
  }
  const result = await fetchXArchive(head, token);
  // Return the SocialArchive JSON directly — the app decodes it as-is. This is
  // the wire contract the SHIPPED 4.46 app depends on, so it keeps its shape
  // even though fetchXArchive now also returns media refs: unwrap, do not leak
  // the envelope.
  return NextResponse.json(result.archive);
}
