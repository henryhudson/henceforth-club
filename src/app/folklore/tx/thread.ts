import type { FolkloreRecord } from "../linkRecord";

// The pure half of a link's page: turn the records fetched for the parent's
// comment txids into the renderable thread. Order is the input list order —
// the index RPUSHes, so list order IS submission order, chronological with
// no re-sort (spec: threads are flat and chronological).

export type ThreadComment = { txid: string; text: string; by?: string };

/**
 * Pure. Keep exactly the comments addressed to THIS parent, in fetched
 * order. Everything else is skipped silently — a hostile or unparseable
 * record (null), a link record riding a comment txid, a comment whose
 * parent is some other transaction. A comment therefore renders nowhere
 * but under its own parent; an orphan whose parent never appears renders
 * nowhere at all (spec §8), and bad chain data is invisible, never an
 * error.
 */
export function assembleThread(
  parentTxid: string,
  fetched: { txid: string; record: FolkloreRecord | null }[],
): ThreadComment[] {
  const parent = parentTxid.toLowerCase();
  return fetched.flatMap(({ txid, record }) =>
    record?.kind === "comment" && record.parent.toLowerCase() === parent
      ? [{ txid, text: record.text, ...(record.by ? { by: record.by } : {}) }]
      : [],
  );
}
