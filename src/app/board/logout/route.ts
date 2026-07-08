import { NextResponse } from "next/server";

// POST /board/logout — clear both cookies and return home. The httpOnly session
// can only be cleared server-side (JS can't touch it), which is why Sign out
// submits here rather than wiping a cookie client-side.
//
// POST, never GET: the router prefetches <Link> hrefs, and a prefetched
// cookie-clearing GET signs the user out on page render instead of on click
// (the 2026-07-05 session-drop bug). 303 so the browser follows with a GET.
export async function POST(req: Request) {
  const res = NextResponse.redirect(new URL("/", req.url), 303);
  res.cookies.set("board_session", "", { httpOnly: true, path: "/", maxAge: 0 });
  res.cookies.set("board_signed_in", "", { path: "/", maxAge: 0 });
  return res;
}
