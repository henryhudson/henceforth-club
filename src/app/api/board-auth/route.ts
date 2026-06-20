import { NextResponse } from "next/server";
import { sha256Hex, createSession, timingSafeEqual } from "@/lib/board-auth";

const NINETY_DAYS_S = 90 * 24 * 60 * 60;
const NINETY_DAYS_MS = NINETY_DAYS_S * 1000;

// POST { password } — password-only login (no username).
// Compares SHA-256(password) to BOARD_SECRET_HASH in constant time, and on a
// match sets two cookies: the httpOnly signed session, and a non-secret
// readable flag the navbar uses to show "Sign out".
export async function POST(req: Request) {
  const secretHash = process.env.BOARD_SECRET_HASH;
  const cookieSecret = process.env.BOARD_COOKIE_SECRET;
  if (!secretHash || !cookieSecret) {
    return NextResponse.json(
      { error: "Board auth is not configured (missing env vars)." },
      { status: 500 },
    );
  }

  let password = "";
  try {
    const body = (await req.json()) as { password?: unknown };
    if (typeof body?.password === "string") password = body.password;
  } catch {
    /* malformed body -> treated as empty -> 401 below */
  }

  const ok =
    password.length > 0 &&
    timingSafeEqual(await sha256Hex(password), secretHash.toLowerCase());
  if (!ok) {
    return NextResponse.json({ error: "Incorrect password." }, { status: 401 });
  }

  const secure = process.env.NODE_ENV === "production";
  const res = NextResponse.json({ ok: true });
  res.cookies.set("board_session", await createSession(cookieSecret, NINETY_DAYS_MS), {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: NINETY_DAYS_S,
  });
  res.cookies.set("board_signed_in", "1", {
    httpOnly: false,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: NINETY_DAYS_S,
  });
  return res;
}
