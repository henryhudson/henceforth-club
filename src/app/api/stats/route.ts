import { NextResponse } from "next/server";
import { getRedis, dateKey } from "@/lib/redis";

// Cache stats for 60 seconds to avoid hammering Redis on every terminal query
export const revalidate = 60;

/**
 * GET /api/stats — aggregated visitor stats.
 * Returns total, week, month, year counts plus a 30-day series for charting.
 */
export async function GET() {
  const redis = getRedis();
  if (!redis) {
    return NextResponse.json({
      ok: false,
      reason: "not-configured",
    });
  }

  try {
    const now = new Date();

    // Build an array of the last 365 days of keys
    const yearKeys: string[] = [];
    for (let i = 0; i < 365; i++) {
      const d = new Date(now);
      d.setUTCDate(d.getUTCDate() - i);
      yearKeys.push(`views:${dateKey(d)}`);
    }

    const [total, ...dayCounts] = await Promise.all([
      redis.get<number>("views:total"),
      ...yearKeys.map((k) => redis.get<number>(k)),
    ]);

    const nums = dayCounts.map((v) => Number(v) || 0);
    const today = nums[0];
    const week = nums.slice(0, 7).reduce((a, b) => a + b, 0);
    const month = nums.slice(0, 30).reduce((a, b) => a + b, 0);
    const year = nums.reduce((a, b) => a + b, 0);

    // 30-day sparkline data (newest last)
    const sparkline = nums.slice(0, 30).reverse();

    return NextResponse.json({
      ok: true,
      total: Number(total) || 0,
      today,
      week,
      month,
      year,
      sparkline,
    });
  } catch {
    return NextResponse.json(
      { ok: false, reason: "error" },
      { status: 500 }
    );
  }
}
