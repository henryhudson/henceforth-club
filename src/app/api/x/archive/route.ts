import { NextResponse } from "next/server";
import { fetchXArchive } from "@/lib/xfetch";
import { fetchTweetsWithMedia, selectRefs, downloadItems } from "@/lib/xArchive";
import { extractMediaRefs } from "@/lib/xMedia";
import { payAndReserve, RESOURCES_WITH_MEDIA } from "@/lib/xGate";

/**
 * GET /api/x/archive?handle=<h>&payment=<txid>&images=1&videos=0
 *
 * Like /api/x/fetch, but also returns downloaded media bytes so the app can
 * inscribe photos and videos alongside the text archive. The shared X bearer
 * token lives only here (env var X_BEARER_TOKEN) and is never returned or logged.
 *
 * This is the expensive endpoint: it pages the timeline twice — once for text and
 * again for media — so before the page cap it could cost $32 in a single
 * unauthenticated request. It now demands a `payment` transaction id, verified on
 * chain against the archive reward address and burned so one payment buys one
 * read, and it reserves its worst-case cost against a hard daily budget before it
 * touches X. See lib/xGate.
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

  const gate = await payAndReserve(url.searchParams.get("payment"), RESOURCES_WITH_MEDIA);
  if (!gate.ok) return gate.response;

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
