import { describe, expect, it } from "vitest";
import { ARCHIVE_ADDRESS_DEFAULT, SURFACE, readSurface, resolveHead } from "./chain-archive";

// The live proof, on demand only: with LIVE_CHAIN set and the archive key in
// the environment, read the board back from the real chain through the real
// indexers. Skipped in the ordinary suite — it touches the network and needs
// the key.
//   node --env-file=.env.local node_modules/vitest/vitest.mjs run src/lib/chain-archive.live.test.ts
// with LIVE_CHAIN=1 in the environment.
const keyHex = process.env.BOARD_ARCHIVE_KEY ?? "";
const address = process.env.BOARD_ARCHIVE_ADDRESS ?? ARCHIVE_ADDRESS_DEFAULT;

describe.skipIf(!process.env.LIVE_CHAIN || !keyHex)("the archive, read live", () => {
  it("resolves a head that names the board's surfaces", async () => {
    const resolved = await resolveHead({ address, keyHex });
    expect(resolved.status).toBe("ok");
    if (resolved.status !== "ok") return;
    expect(resolved.head.surfaces[SURFACE.board]).toMatch(/^[0-9a-f]{64}$/);
    expect(resolved.head.surfaces[SURFACE.done]).toMatch(/^[0-9a-f]{64}$/);
    expect(Object.keys(resolved.head.surfaces).length).toBeGreaterThan(2);
  }, 60_000);

  it("opens the live board and the done ledger", async () => {
    const latest = await readSurface({ surface: SURFACE.board, address, keyHex });
    expect(latest.status).toBe("ok");
    if (latest.status !== "ok") return;
    const board = JSON.parse(Buffer.from(latest.document).toString("utf8")) as { generated: string; cards: { col: string }[] };
    expect(board.generated).toBeTruthy();
    expect(board.cards.every((c) => c.col !== "done")).toBe(true);

    const done = await readSurface({ surface: SURFACE.done, address, keyHex });
    expect(done.status).toBe("ok");
    if (done.status !== "ok") return;
    const ledger = JSON.parse(Buffer.from(done.document).toString("utf8")) as { cards: { col: string }[] };
    expect(ledger.cards.length).toBeGreaterThan(0);
    expect(ledger.cards.every((c) => c.col === "done")).toBe(true);
  }, 120_000);
});
