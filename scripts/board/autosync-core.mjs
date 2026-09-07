// The pure half of the board autosync: the mirror record lifted from the
// canonical board-data.js text, and the guard that keeps a collapsed board out
// of it. Kept apart from the watcher so it can be tested without starting a
// watch loop.
//
// The week rides along. On 2 September the mirror was rebuilt from the
// canonical file without it, then published, so every board edit wiped the
// store's week planner within a minute and the day's done marks never stuck.
// The month and the year (The Board's book, 7 September) ride the same way.
//
// The guard is from 7 September. A stray test wrote a one-card fixture board
// over the canonical file; the shape check below passed it, the mirror carried
// it to the store within seconds and the publisher put a one-card board on the
// chain. A board with fewer than half the last good board's cards, or a
// dateline behind it, is a fixture, a truncated save or the wrong file, never
// a morning's edit: it stays out, and the next good write goes through. The
// publisher runs the same predicate against the store's own board.

/** The calendar date a `generated` line opens with, or null when it has none. */
const dateOf = (board) => board.generated?.match(/^\d{4}-\d{2}-\d{2}/)?.[0] ?? null;
const cardCount = (board) => board.cards?.length ?? 0;

/** True when `candidate` must not replace `lastGood`: fewer than half its
 *  cards, or a dateline earlier than its. No last good board (a first mirror,
 *  an empty store) refuses nothing. */
export function boardLooksCollapsed(candidate, lastGood) {
  if (!lastGood) return false;
  if (cardCount(candidate) * 2 < cardCount(lastGood)) return true;
  const [date, lastDate] = [candidate, lastGood].map(dateOf);
  return date !== null && lastDate !== null && date < lastDate;
}

/** What a refusal names: both boards by card count and dateline. */
export function collapseCounts(candidate, lastGood) {
  const named = (board) =>
    `${cardCount(board)} card${cardCount(board) === 1 ? "" : "s"} dated ${board.generated?.slice(0, 16)}`;
  return `${named(candidate)} against the last good ${named(lastGood)}`;
}

/** The mirror record for board-data.js text: { generated, generatedAt, cards,
 *  week?, month?, year? }. Throws when the text does not yield a board, which
 *  is what a mid-edit file looks like, and when it yields one that has
 *  collapsed against `lastGood`, the mirror as it stands. */
export function latestFromBoardData(src, generatedAt, lastGood = null) {
  const shim = {};
  new Function("window", src)(shim);
  const board = shim.MORNING_BOARD;
  if (!board || typeof board.generated !== "string" || !Array.isArray(board.cards)) {
    throw new Error("board-data.js did not yield { generated, cards } (mid-edit?)");
  }
  if (boardLooksCollapsed(board, lastGood)) {
    throw new Error(`REFUSED a collapsed board: ${collapseCounts(board, lastGood)}; the last good mirror stands`);
  }
  return {
    generated: board.generated,
    generatedAt,
    cards: board.cards,
    ...(board.week ? { week: board.week } : {}),
    ...(board.month ? { month: board.month } : {}),
    ...(board.year ? { year: board.year } : {}),
  };
}
