import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySession } from "@/lib/board-auth";
import { getRedis } from "@/lib/redis";

export const runtime = "nodejs";

// The middleware already gates /board/:path*, but tax filings also verify the
// session in-handler (same as the planner tick): a future matcher change must
// never be able to expose them. Responses are private and uncacheable so no
// shared cache can hold a copy past the sign-in.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ year: string; slug: string }> },
) {
  const secret = process.env.BOARD_COOKIE_SECRET ?? "";
  const token = (await cookies()).get("board_session")?.value;
  if (!secret || !(await verifySession(token, secret))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const redis = getRedis();
  if (!redis) return NextResponse.json({ error: "no store" }, { status: 503 });

  const { year, slug } = await params;
  const file = await redis.get<{ name: string; b64: string }>(
    `board:taxes:file:${year}:${slug}`,
  );
  if (!file?.b64) return NextResponse.json({ error: "not found" }, { status: 404 });

  return new NextResponse(new Uint8Array(Buffer.from(file.b64, "base64")), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${file.name.replace(/"/g, "")}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
