// The Top chart's pure core — plan task 9R. Rank is kudos received that
// day, duels and tips alike, folded from the day's received stream; no Elo,
// no wildcards, no decay. Threads roll up: a kudos landing anywhere in a
// self-reply thread counts toward the thread root, so a body of work charts
// as one unit. All total functions; the page owns the Redis and archive
// reads.

/** One kudos'd post as the fold sums it. */
export type DayKudos = { postId: string; author: string; amount: number };

export type ChartPost = { postId: string; amount: number };

/** One charted unit: a thread (or lone post) and the day's kudos on it.
 * Continuations render above the root, largest first, per the plan. */
export type ChartUnit = {
  rootPostId: string;
  author: string;
  total: number;
  rootAmount: number;
  continuations: ChartPost[];
};

/** True for a string that names a real calendar day as YYYY-MM-DD. */
function isRealDay(day: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return false;
  const parsed = new Date(`${day}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === day;
}

/**
 * The day the chart shows for a `?day=` parameter: the named day when it is
 * a real one no later than today; today otherwise. YYYY-MM-DD compares
 * chronologically as a plain string, so the clamp is one comparison.
 */
export function chartDay(param: string | undefined, today: string): string {
  if (param === undefined || !isRealDay(param)) return today;
  return param <= today ? param : today;
}

function shiftDay(day: string, byDays: number): string {
  const shifted = new Date(Date.parse(`${day}T00:00:00Z`) + byDays * 86_400_000);
  return shifted.toISOString().slice(0, 10);
}

/** The calendar day before `day` — the chart's back link. */
export function previousDay(day: string): string {
  return shiftDay(day, -1);
}

/** The calendar day after `day` — the chart's forward link. */
export function nextDay(day: string): string {
  return shiftDay(day, 1);
}

/**
 * The thread root a post's kudos roll up to: walk the parent links to the
 * top. A post with no parent is its own root. Total on any map — a cyclic
 * link (malformed data) terminates at the last post before the repeat.
 */
export function rootOf(postId: string, parentOf: ReadonlyMap<string, string>): string {
  let current = postId;
  const visited = new Set([current]);
  for (
    let parent = parentOf.get(current);
    parent !== undefined && !visited.has(parent);
    parent = parentOf.get(current)
  ) {
    current = parent;
    visited.add(current);
  }
  return current;
}

/**
 * Fold one day's kudos into the ranked chart: sum per post, roll each post
 * up to its thread root, one unit per root ranked by the day's total.
 * Deterministic throughout — ties break on post id, so the same day always
 * charts the same way.
 */
export function buildChart(
  entries: readonly DayKudos[],
  parentOf: ReadonlyMap<string, string>,
): ChartUnit[] {
  const byPost = new Map<string, DayKudos>();
  for (const { postId, author, amount } of entries) {
    const standing = byPost.get(postId);
    if (standing) standing.amount += amount;
    else byPost.set(postId, { postId, author, amount });
  }

  const units = new Map<string, ChartUnit>();
  for (const { postId, author, amount } of byPost.values()) {
    const rootPostId = rootOf(postId, parentOf);
    const unit =
      units.get(rootPostId) ??
      { rootPostId, author, total: 0, rootAmount: 0, continuations: [] };
    unit.total += amount;
    if (postId === rootPostId) unit.rootAmount += amount;
    else unit.continuations.push({ postId, amount });
    units.set(rootPostId, unit);
  }

  const byAmountThenId = (a: ChartPost, b: ChartPost) =>
    b.amount - a.amount || a.postId.localeCompare(b.postId);
  return [...units.values()]
    .map((unit) => ({ ...unit, continuations: [...unit.continuations].sort(byAmountThenId) }))
    .sort((a, b) => b.total - a.total || a.rootPostId.localeCompare(b.rootPostId));
}
