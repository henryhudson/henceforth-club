// The pure half of publishing the board to the chain: which surface each
// document is, whether its content changed since its last inscription, and
// how the publisher's local ledger evolves as inscriptions land. No I/O.
//
// The ledger is the publisher's memory, not the archive's. The chain and its
// head are the truth; the ledger only remembers each surface's newest
// transaction and content digest so an unchanged document is not paid for
// twice. Losing it costs one full re-inscription and nothing else.

import { createHash } from "node:crypto";

export const BOARD_SURFACE = "board-latest";
export const DONE_SURFACE = "board-done";
export const GARDENING_SURFACE = "board-gardening";
export const reportSurface = (date) => `board-report-${date}`;
export const weekSurface = (date) => `board-week-${date}`;

/** The board is two documents on the chain. The live columns and the week
 *  change on every publish and seal small; the done ledger is the bulk of the
 *  board (its prose compresses only three to one) and changes only when a
 *  card lands in done, so it is inscribed only then. */
export function splitBoard(board) {
  const cards = board.cards ?? [];
  return {
    latest: { ...board, cards: cards.filter((c) => c.col !== "done") },
    done: { cards: cards.filter((c) => c.col === "done") },
  };
}

/** JSON with sorted keys at every level, so the same content always produces
 *  the same bytes and a key-order difference never costs a fee. */
export function canonicalBytes(document) {
  return Buffer.from(stableStringify(document), "utf8");
}
function stableStringify(value) {
  if (Array.isArray(value)) return "[" + value.map(stableStringify).join(",") + "]";
  if (value !== null && typeof value === "object") {
    return "{" + Object.keys(value).sort().map((k) => JSON.stringify(k) + ":" + stableStringify(value[k])).join(",") + "}";
  }
  return JSON.stringify(value);
}

export const digestOf = (bytes) => createHash("sha256").update(bytes).digest("hex");

export const EMPTY_LEDGER = { surfaces: {}, head: null };

/** The documents whose content is not what the ledger last inscribed —
 *  new surfaces and changed ones alike. Order is preserved. */
export function changedDocuments(documents, ledger) {
  return documents.filter((d) => ledger.surfaces[d.surface]?.sha256 !== digestOf(d.bytes));
}

/** The ledger after one surface's inscription landed. */
export function withInscription(ledger, { surface, txid, sha256, date }) {
  return { ...ledger, surfaces: { ...ledger.surfaces, [surface]: { txid, sha256, date } } };
}

/** The ledger after a head landed. */
export function withHead(ledger, { txid, date }) {
  return { ...ledger, head: { txid, date } };
}

/** What the next head names: every known surface's current transaction. */
export function headSurfaces(ledger) {
  return Object.fromEntries(Object.entries(ledger.surfaces).map(([surface, entry]) => [surface, entry.txid]));
}
