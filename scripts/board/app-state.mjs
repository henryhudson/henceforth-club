// Per-app "state of the app" for /whh — is each app earning its users?
// Available today with no extra credentials: downloads (from the sales pull) + App Store ratings
// (public iTunes lookup). The richer App Analytics signals — active users, retention, crash rate —
// fill the `analytics` slot once that feed backfills.

/** Pure: extract {average, count, version} from an iTunes lookup response. */
export function parseRatings(json) {
  const r = json?.results?.[0];
  if (!r) return { average: null, count: 0 };
  return { average: r.averageUserRating ?? null, count: r.userRatingCount ?? 0, version: r.version ?? null };
}

/** Fetch App Store ratings for one app — public iTunes lookup, no auth. Never throws. */
export async function fetchRatings(appId, { country = "gb", fetchImpl = fetch } = {}) {
  try {
    const res = await fetchImpl(`https://itunes.apple.com/lookup?id=${appId}&country=${country}`);
    if (!res.ok) return { average: null, count: 0 };
    return parseRatings(await res.json());
  } catch { return { average: null, count: 0 }; }
}

/** Pure: assemble the per-app state from the pieces available now (downloads + ratings). */
export function buildAppState({ apps, sales, ratings }) {
  const salesByApp = Object.fromEntries((sales?.perApp ?? []).map((a) => [a.app, a]));
  return apps.map(({ key, name }) => {
    const s = salesByApp[key];
    return {
      app: key,
      name,
      downloads: s ? { thisWeek: s.units.thisWeek, lastWeek: s.units.lastWeek, deltaPct: s.units.deltaPct } : null,
      rating: ratings[key] ?? { average: null, count: 0 },
      analytics: null, // active users / retention / crash rate — fills when App Analytics backfills
      verdict: null,   // the agent's value read — written by /whh synthesis
    };
  });
}

/** Pull the per-app state: live App Store ratings joined to the downloads already in `sales`. */
export async function pullAppState({ apps, sales, fetchImpl = fetch }) {
  const ratings = {};
  for (const { key, appId } of apps) ratings[key] = await fetchRatings(appId, { fetchImpl });
  return buildAppState({ apps, sales, ratings });
}
