import { NextResponse } from "next/server";
import { fetchXArchive } from "@/lib/xfetch";
import { getRedis } from "@/lib/redis";

/**
 * GET /api/x/fetch?handle=<h>
 *
 * The shared-token fetch: the X bearer token lives ONLY here (env var
 * X_BEARER_TOKEN), never in the app, so every user can archive a profile
 * without configuring anything. Rate-limited per IP because each call spends
 * real X-API credits — the float is the operator's money.
 */
export async function GET(req: Request) {
  const token = process.env.X_BEARER_TOKEN;
  if (!token) {
    return NextResponse.json({ ok: false, reason: "server-token-unset" }, { status: 503 });
  }

  const handle = new URL(req.url).searchParams.get("handle")?.trim().replace(/^@/, "") ?? "";
  if (!/^[A-Za-z0-9_]{1,15}$/.test(handle)) {
    return NextResponse.json({ ok: false, reason: "bad-handle" }, { status: 400 });
  }

  // Abuse guard: 10 fetches / IP / hour. Real money per call.
  const redis = getRedis();
  if (redis) {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const key = `xfetch:rl:${ip}`;
    const n = await redis.incr(key);
    if (n === 1) await redis.expire(key, 3600);
    if (n > 10) {
      return NextResponse.json({ ok: false, reason: "rate-limited" }, { status: 429 });
    }
  }

  const archive = await fetchXArchive(handle, token);
  if (!archive) {
    return NextResponse.json({ ok: false, reason: "no-user" }, { status: 404 });
  }
  // Return the SocialArchive JSON directly — the app decodes it as-is.
  return NextResponse.json(archive);
}
