import { NextResponse } from "next/server";
import { authenticateBearer } from "@/lib/kudos/auth";
import { readFloat } from "@/lib/kudos/float";

function refusal(reason: string, status: number) {
  return NextResponse.json({ ok: false, reason }, { status });
}

/**
 * GET /api/folklore/float — the bearer's own spendable balance.
 *
 * The float is private: only the bearer token that owns it can read it, and
 * the balance is server-authoritative. The KUDOS_ENABLED gate is read per
 * request, exactly like the archive flag on the job route — while it is off,
 * nothing kudos-shaped is reachable.
 */
export async function GET(req: Request) {
  if (process.env.KUDOS_ENABLED !== "true") {
    return refusal("not-available", 503);
  }

  const auth = await authenticateBearer(req);
  if (auth.kind === "unavailable") return refusal("unavailable", 503);
  if (auth.kind !== "authenticated") return refusal(auth.kind, 401);

  const float = await readFloat(auth.profile);
  return NextResponse.json({ ok: true, profile: auth.profile, float });
}
