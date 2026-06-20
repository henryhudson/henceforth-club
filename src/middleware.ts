import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifySession } from "@/lib/board-auth";

// Gate /board and everything under it, EXCEPT the login + logout endpoints
// (which must be reachable while signed out). An invalid/absent session
// redirects to the login, preserving where the user was headed.
export const config = { matcher: ["/board", "/board/:path*"] };

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (pathname === "/board/login" || pathname === "/board/logout") {
    return NextResponse.next();
  }

  const secret = process.env.BOARD_COOKIE_SECRET ?? "";
  const ok =
    secret.length > 0 &&
    (await verifySession(req.cookies.get("board_session")?.value, secret));
  if (ok) return NextResponse.next();

  const url = req.nextUrl.clone();
  url.pathname = "/board/login";
  url.search = `?from=${encodeURIComponent(pathname)}`;
  return NextResponse.redirect(url);
}
