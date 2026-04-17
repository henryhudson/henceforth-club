import { NextResponse } from "next/server";
import { getRedis, dateKey } from "@/lib/redis";

/**
 * POST /api/hit — increments the visitor counter.
 * Stores:
 *   views:total       (single counter)
 *   views:YYYY-MM-DD  (per-day counter)
 * Returns { visitor: <visitor number> } on success, or { ok: false } if Redis isn't configured.
 */
export async function POST() {
  const redis = getRedis();
  if (!redis) {
    return NextResponse.json({ ok: false, reason: "not-configured" });
  }

  const today = dateKey();
  try {
    const [total] = await Promise.all([
      redis.incr("views:total"),
      redis.incr(`views:${today}`),
    ]);
    return NextResponse.json({ ok: true, visitor: total });
  } catch {
    return NextResponse.json({ ok: false, reason: "error" }, { status: 500 });
  }
}
