import { NextResponse } from "next/server";
import { getArchivePage, PAGE_SIZE } from "@/lib/xArchiveCache";

/**
 * GET /api/x/posts?handle=<handle>&offset=<n>&mode=latest
 *
 * One page of an already-archived profile's posts, for the client
 * scroll-loader to append after the profile page's server-rendered first
 * page. `mode` is here so a future "oldest first" or "around a post" reading
 * order has somewhere to go without a breaking change; only `latest` exists
 * today. The page size is fixed server-side (`PAGE_SIZE`) so the offset the
 * client sends next always lines up with what the server actually returned.
 * `txTimes` is the whole archive's known transaction times (not just this
 * page's) — small and stable per handle, so it rides along on every page
 * rather than needing its own request.
 */
export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;

  const handle = (params.get("handle") ?? "").trim().replace(/^@/, "");
  if (!/^[A-Za-z0-9_]{1,15}$/.test(handle)) {
    return NextResponse.json({ ok: false, reason: "bad-handle" }, { status: 400 });
  }

  const mode = params.get("mode") ?? "latest";
  if (mode !== "latest") {
    return NextResponse.json({ ok: false, reason: "bad-mode" }, { status: 400 });
  }

  const offset = Number(params.get("offset") ?? "0");
  if (!Number.isInteger(offset) || offset < 0) {
    return NextResponse.json({ ok: false, reason: "bad-offset" }, { status: 400 });
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
