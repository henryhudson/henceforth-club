import { NextResponse } from "next/server";
import { fetchXArchive } from "@/lib/xfetch";
import { fetchTweetsWithMedia, selectRefs, downloadItems } from "@/lib/xArchive";
import { extractMediaRefs } from "@/lib/xMedia";
import { getRedis } from "@/lib/redis";

/**
 * GET /api/x/archive?handle=<h>&images=1&videos=0
 *
 * Like /api/x/fetch, but also returns downloaded media bytes so the app can
 * inscribe photos and videos alongside the text archive. The shared X bearer
 * token lives only here (env var X_BEARER_TOKEN) and is never returned or
 * logged. Rate-limited per IP, separately from /api/x/fetch, because this
 * call spends more credits and bandwidth (it downloads media too).
 */

function flag(value: string | null, defaultValue: boolean): boolean {
  return value === null ? defaultValue : value !== "0";
}

export async function GET(req: Request) {
  const token = process.env.X_BEARER_TOKEN;
  if (!token) {
    return NextResponse.json({ ok: false, reason: "server-token-unset" }, { status: 503 });
  }

  const url = new URL(req.url);
  const handle = url.searchParams.get("handle")?.trim().replace(/^@/, "") ?? "";
  if (!/^[A-Za-z0-9_]{1,15}$/.test(handle)) {
    return NextResponse.json({ ok: false, reason: "bad-handle" }, { status: 400 });
  }
  const includeImages = flag(url.searchParams.get("images"), true);
  const includeVideos = flag(url.searchParams.get("videos"), false);

  // Abuse guard: 10 fetches / IP / hour. Real money per call.
  const redis = getRedis();
  if (redis) {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const key = `xarchive:rl:${ip}`;
    const n = await redis.incr(key);
    if (n === 1) await redis.expire(key, 3600);
    if (n > 10) {
      return NextResponse.json({ ok: false, reason: "rate-limited" }, { status: 429 });
    }
  }

  const archive = await fetchXArchive(handle, token);
  const userId = archive?.profile.accountId;
  if (!archive || !userId) {
    return NextResponse.json({ ok: false, reason: "no-user" }, { status: 404 });
  }

  const tweetsWithMedia = await fetchTweetsWithMedia(userId, token);
  const refs = extractMediaRefs(tweetsWithMedia);
  const selected = selectRefs(refs, includeImages, includeVideos);
  const media = await downloadItems(selected);

  return Response.json({ archive, media });
}
