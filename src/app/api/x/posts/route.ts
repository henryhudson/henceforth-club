import { NextResponse } from "next/server";
import { getArchivePage, PAGE_SIZE } from "@/lib/xArchiveCache";
import { postsWithMedia } from "@/lib/xMediaFilter";
import { getHotArchivePage } from "@/lib/xHotFeed";

/**
 * GET /api/x/posts?handle=<handle>&offset=<n>&mode=latest|videos|photos
 *
 * One page of an already-archived profile's posts, for the client
 * scroll-loader to append after the profile page's server-rendered first
 * page. `latest` pages the archive at the fixed server-side `PAGE_SIZE` so
 * the offset the client sends next always lines up with what the server
 * actually returned. The media modes (`videos` / `photos`) answer a
 * different question — "where is the media in this archive" — so they scan
 * the WHOLE archive and return every match in one response, newest first,
 * with `postCount` meaning the match count: an archive's twenty-three videos
 * scattered through seventeen hundred posts arrive as one list, not as
 * something the reader must scroll sixteen hundred text posts to find.
 * `txTimes` is the whole archive's known transaction times (not just this
 * page's) — small and stable per handle, so it rides along on every page
 * rather than needing its own request.
 */
const MODES = new Set(["latest", "hot", "videos", "photos"]);
/** Far above X's own per-profile export ceiling — the media scan is uncapped
 * in practice; a cap that silently dropped an old tutorial would be worse
 * than the read cost of walking every chunk. */
const WHOLE_ARCHIVE = 100_000;

export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;

  const handle = (params.get("handle") ?? "").trim().replace(/^@/, "");
  if (!/^[A-Za-z0-9_]{1,15}$/.test(handle)) {
    return NextResponse.json({ ok: false, reason: "bad-handle" }, { status: 400 });
  }

  const mode = params.get("mode") ?? "latest";
  if (!MODES.has(mode)) {
    return NextResponse.json({ ok: false, reason: "bad-mode" }, { status: 400 });
  }

  const offset = Number(params.get("offset") ?? "0");
  if (!Number.isInteger(offset) || offset < 0) {
    return NextResponse.json({ ok: false, reason: "bad-offset" }, { status: 400 });
  }

  if (mode === "hot") {
    // Ranked over the whole archive, then sliced — see xHotFeed. `postCount`
    // stays the archive total: hot pages the same set in a different order.
    const page = await getHotArchivePage(handle, offset, PAGE_SIZE);
    if (!page) {
      return NextResponse.json({ ok: false, reason: "not-found" }, { status: 404 });
    }
    return NextResponse.json({
      profile: page.profile,
      posts: page.posts,
      offset,
      postCount: page.postCount,
      txTimes: page.txTimes,
    });
  }

  if (mode === "videos" || mode === "photos") {
    const whole = await getArchivePage(handle, 0, WHOLE_ARCHIVE);
    if (!whole) {
      return NextResponse.json({ ok: false, reason: "not-found" }, { status: 404 });
    }
    const matches = postsWithMedia(whole.posts, mode === "videos" ? "video" : "photo");
    return NextResponse.json({
      profile: whole.profile,
      posts: matches,
      offset: 0,
      postCount: matches.length,
      txTimes: whole.txTimes,
    });
  }

  const page = await getArchivePage(handle, offset, PAGE_SIZE);
  if (!page) {
    return NextResponse.json({ ok: false, reason: "not-found" }, { status: 404 });
  }

  return NextResponse.json({
    // The archived profile, so a client writing a NEW archive transaction can
    // carry the existing bio/avatar forward unchanged — the app's `xmedia`
    // word does exactly this. A transaction that shipped an empty profile
    // would blank what the reader takes from the newest one.
    profile: page.profile,
    posts: page.posts,
    offset,
    postCount: page.postCount,
    txTimes: page.txTimes,
  });
}
