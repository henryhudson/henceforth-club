import { NextResponse } from "next/server";
import { backlog } from "@/lib/backlog";

/** GET /api/backlog — the current "what's next" list, printed by the Henceforth `todo` word. */
export async function GET() {
  return NextResponse.json({ items: backlog });
}
