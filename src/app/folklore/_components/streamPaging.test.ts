import { describe, expect, it } from "vitest";
import { absorbPage, initialStreamState } from "./streamPaging";

// The seeding contract: a stream seeded with the server's own head pages on
// from its length; a stream seeded by CURATION (the front page's showcase
// seats) still pages from the server's rank top, deduplicating against the
// seats — so a genuinely hot post outside the owner's picks arrives on the
// first scroll instead of being skipped forever.

describe("initialStreamState", () => {
  it("counts a server-ordered seed as already served", () => {
    const state = initialStreamState({
      pageable: true,
      seeded: true,
      curatedSeed: false,
      seedCount: 30,
      totalKnown: 1700,
    });
    expect(state).toEqual({ extra: [], served: 30, exhausted: false });
  });

  it("leaves the cursor at the rank top under a curated seed — the seats are not the stream", () => {
    const state = initialStreamState({
      pageable: true,
      seeded: true,
      curatedSeed: true,
      seedCount: 6,
      totalKnown: 1700,
    });
    expect(state.served).toBe(0);
    expect(state.exhausted).toBe(false);
  });

  it("starts the unseeded stream at the top, and a non-pageable feed exhausted", () => {
    expect(
      initialStreamState({ pageable: true, seeded: false, curatedSeed: false, seedCount: 30, totalKnown: 1700 }),
    ).toEqual({ extra: [], served: 0, exhausted: false });
    expect(
      initialStreamState({ pageable: false, seeded: true, curatedSeed: false, seedCount: 3, totalKnown: 3 }),
    ).toEqual({ extra: [], served: 3, exhausted: true });
  });

  it("marks a seed that already covers the whole archive exhausted, curated or not", () => {
    for (const curatedSeed of [false, true]) {
      const state = initialStreamState({ pageable: true, seeded: true, curatedSeed, seedCount: 6, totalKnown: 6 });
      expect(state.exhausted).toBe(true);
    }
  });
});

describe("absorbPage", () => {
  const post = (id: string) => ({ id });

  it("a genuinely hot top post outside the curated seats arrives on the first page", () => {
    // Server hot order: monument first; the owner's picks seated ep9 and
    // kepler instead. Under offset-by-shown-count the first fetch began at
    // rank 3 and monument never appeared.
    const seats = [post("ep9"), post("kepler")];
    const serverHotOrder = [post("monument"), post("ep9"), post("kepler"), post("clip")];
    const seeded = initialStreamState<{ id: string }>({
      pageable: true,
      seeded: true,
      curatedSeed: true,
      seedCount: seats.length,
      totalKnown: serverHotOrder.length,
    });
    const firstPage = serverHotOrder.slice(seeded.served, seeded.served + 4);
    const grown = absorbPage(seeded, new Set(seats.map((p) => p.id)), firstPage, serverHotOrder.length);
    expect(grown.extra.map((p) => p.id)).toEqual(["monument", "clip"]);
    expect(grown.exhausted).toBe(true);
  });

  it("advances the cursor by the whole page even when duplicates were dropped from display", () => {
    const state = initialStreamState<{ id: string }>({
      pageable: true,
      seeded: true,
      curatedSeed: true,
      seedCount: 2,
      totalKnown: 10,
    });
    const grown = absorbPage(state, new Set(["a", "b"]), [post("a"), post("b"), post("c")], 10);
    expect(grown.extra.map((p) => p.id)).toEqual(["c"]);
    expect(grown.served).toBe(3); // the server served three — the next offset must be 3, not 1
    expect(grown.exhausted).toBe(false);
  });

  it("judges exhaustion by the cursor against the archive total, and an empty page as the end", () => {
    const state = { extra: [post("x")], served: 8, exhausted: false };
    expect(absorbPage(state, new Set(), [post("y"), post("z")], 10).exhausted).toBe(true);
    expect(absorbPage(state, new Set(), [post("y")], 10).exhausted).toBe(false);
    expect(absorbPage(state, new Set(), [], 10).exhausted).toBe(true);
  });
});
