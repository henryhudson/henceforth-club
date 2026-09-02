import { describe, expect, it } from "vitest";
import {
  EMPTY_LEDGER,
  canonicalBytes,
  splitBoard,
  changedDocuments,
  digestOf,
  headSurfaces,
  reportSurface,
  weekSurface,
  withHead,
  withInscription,
} from "./chain-publish-core.mjs";

const TXID_A = "a".repeat(64);
const TXID_B = "b".repeat(64);

describe("canonical bytes", () => {
  it("are the same for the same content in a different key order", () => {
    const one = canonicalBytes({ generated: "now", cards: [{ id: "x", rev: 1 }] });
    const two = canonicalBytes({ cards: [{ rev: 1, id: "x" }], generated: "now" });
    expect(digestOf(one)).toBe(digestOf(two));
  });

  it("differ when the content differs", () => {
    expect(digestOf(canonicalBytes({ rev: 1 }))).not.toBe(digestOf(canonicalBytes({ rev: 2 })));
  });

  it("parse back to the same document", () => {
    const doc = { a: [1, { b: null, c: "d" }], e: false };
    expect(JSON.parse(canonicalBytes(doc).toString("utf8"))).toEqual(doc);
  });
});

describe("splitting the board", () => {
  it("keeps the live columns and the week together, and the done ledger apart", () => {
    const board = {
      generated: "now",
      week: { weekOf: "2026-08-30", weekPlan: [] },
      cards: [{ id: "a", col: "todo" }, { id: "b", col: "done" }, { id: "c", col: "review" }],
    };
    const { latest, done } = splitBoard(board);
    expect(latest).toEqual({ generated: "now", week: board.week, cards: [{ id: "a", col: "todo" }, { id: "c", col: "review" }] });
    expect(done).toEqual({ cards: [{ id: "b", col: "done" }] });
  });

  it("the done ledger's bytes do not move when only a live card changes", () => {
    const before = { generated: "1", cards: [{ id: "a", col: "todo", rev: 1 }, { id: "b", col: "done" }] };
    const after = { generated: "2", cards: [{ id: "a", col: "todo", rev: 2 }, { id: "b", col: "done" }] };
    expect(digestOf(canonicalBytes(splitBoard(before).done))).toBe(digestOf(canonicalBytes(splitBoard(after).done)));
    expect(digestOf(canonicalBytes(splitBoard(before).latest))).not.toBe(digestOf(canonicalBytes(splitBoard(after).latest)));
  });
});

describe("surface names", () => {
  it("are lowercase slugs the envelope accepts", () => {
    for (const s of [reportSurface("2026-09-01"), weekSurface("2026-08-30")]) expect(s).toMatch(/^[a-z][a-z0-9-]*$/);
  });
});

describe("change detection against the ledger", () => {
  const board = { surface: "board-latest", bytes: canonicalBytes({ cards: [] }) };
  const report = { surface: reportSurface("2026-09-01"), bytes: canonicalBytes({ date: "2026-09-01" }) };

  it("an empty ledger means everything is new", () => {
    expect(changedDocuments([board, report], EMPTY_LEDGER)).toEqual([board, report]);
  });

  it("a document whose digest the ledger already holds is not re-inscribed", () => {
    const ledger = withInscription(EMPTY_LEDGER, {
      surface: board.surface, txid: TXID_A, sha256: digestOf(board.bytes), date: "2026-09-01",
    });
    expect(changedDocuments([board, report], ledger)).toEqual([report]);
  });

  it("a changed document is inscribed again", () => {
    const ledger = withInscription(EMPTY_LEDGER, {
      surface: board.surface, txid: TXID_A, sha256: digestOf(board.bytes), date: "2026-09-01",
    });
    const changed = { surface: "board-latest", bytes: canonicalBytes({ cards: [{ id: "new" }] }) };
    expect(changedDocuments([changed], ledger)).toEqual([changed]);
  });
});

describe("the ledger", () => {
  it("names every surface's current transaction for the next head", () => {
    let ledger = withInscription(EMPTY_LEDGER, { surface: "board-latest", txid: TXID_A, sha256: "x", date: "2026-09-01" });
    ledger = withInscription(ledger, { surface: "board-latest", txid: TXID_B, sha256: "y", date: "2026-09-02" });
    ledger = withInscription(ledger, { surface: "board-gardening", txid: TXID_A, sha256: "z", date: "2026-09-02" });
    expect(headSurfaces(ledger)).toEqual({ "board-latest": TXID_B, "board-gardening": TXID_A });
  });

  it("records the head without disturbing the surfaces, immutably", () => {
    const before = withInscription(EMPTY_LEDGER, { surface: "board-latest", txid: TXID_A, sha256: "x", date: "2026-09-01" });
    const after = withHead(before, { txid: TXID_B, date: "2026-09-01" });
    expect(after.head).toEqual({ txid: TXID_B, date: "2026-09-01" });
    expect(after.surfaces).toEqual(before.surfaces);
    expect(before.head).toBeNull();
  });
});
