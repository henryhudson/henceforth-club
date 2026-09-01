// The 06:00 roll's persist rules. Extracted so the consolation path
// (`writeBoardFiles` then catch `redis.set` and exit 0) cannot come back
// as a comment claiming the opposite.
//
// Two rules, both from finding-board-roll-clobbers-board-2026-08-27:
//   1. Do not trust a store that merely answered — pick the newer of store
//      and local file by generatedAt, so a four-day-old store cannot
//      overwrite tonight's board.
//   2. Write the store first. Local files follow only after it lands. A
//      refused store write leaves the files alone and fails.

/** Prefer the newer board. Equal or missing timestamps keep the store, which
 *  was the previous default when both sides existed. */
export function pickBoard(fromStore, fromFile) {
  if (fromStore && fromFile) {
    const storeAt = Date.parse(fromStore.generatedAt || "") || 0;
    const fileAt = Date.parse(fromFile.generatedAt || "") || 0;
    return fileAt > storeAt ? fromFile : fromStore;
  }
  return fromStore ?? fromFile ?? null;
}

/** Persist a patched board. Store first; files only after it succeeds.
 *  `redis` may be null (no creds) — then only files are written. */
export async function persistBoard(board, { redis, writeFiles }) {
  if (redis) {
    try {
      await redis.set("board:latest", board);
    } catch (e) {
      throw new Error(`store write failed (local files not updated): ${e.message}`, { cause: e });
    }
  }
  await writeFiles(board);
}
