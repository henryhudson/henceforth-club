import { NextResponse } from "next/server";

// GET /board/logout — clear both cookies and return home. The httpOnly session
// can only be cleared server-side (JS can't touch it), which is why Sign out
// navigates here rather than wiping a cookie client-side.
export async function GET(req: Request) {
  const res = NextResponse.redirect(new URL("/", req.url));
  res.cookies.set("board_session", "", { httpOnly: true, path: "/", maxAge: 0 });
  res.cookies.set("board_signed_in", "", { path: "/", maxAge: 0 });
  return res;
}
