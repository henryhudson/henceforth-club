// The pure half of the board autosync: the mirror record lifted from the
// canonical board-data.js text. Kept apart from the watcher so it can be
// tested without starting a watch loop.
//
// The week rides along. On 2 September the mirror was rebuilt from the
// canonical file without it, then published, so every board edit wiped the
// store's week planner within a minute and the day's done marks never stuck.

/** The mirror record for board-data.js text: { generated, generatedAt, cards, week? }.
 *  Throws when the text does not yield a board, which is what a mid-edit
 *  file looks like. */
export function latestFromBoardData(src, generatedAt) {
  const shim = {};
  new Function("window", src)(shim);
  const board = shim.MORNING_BOARD;
  if (!board || typeof board.generated !== "string" || !Array.isArray(board.cards)) {
    throw new Error("board-data.js did not yield { generated, cards } (mid-edit?)");
  }
  return {
    generated: board.generated,
    generatedAt,
    cards: board.cards,
    ...(board.week ? { week: board.week } : {}),
  };
}
