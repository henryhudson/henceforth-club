import { describe, expect, it } from "vitest";
import { commitDue, restingBeat, tap } from "./kudosBeat";

const BEAT = 900;

describe("the commit beat — rapid taps batch into one committed amount", () => {
  it("accumulates rapid taps into one pending amount", () => {
    const beat = [1000, 1100, 1200].reduce((b, at) => tap(b, at, BEAT), restingBeat);
    expect(beat.pending).toBe(3);
  });

  it("extends the beat with every tap — the beat closes after the LAST tap", () => {
    const beat = tap(tap(restingBeat, 1000, BEAT), 1500, BEAT);
    expect(beat.closesAt).toBe(1500 + BEAT);
  });

  it("commits nothing while the beat is still open", () => {
    const beat = tap(restingBeat, 1000, BEAT);
    const due = commitDue(beat, 1000 + BEAT - 1);
    expect(due.commit).toBe(0);
    expect(due.beat).toEqual(beat);
  });

  it("commits the whole pending amount once the beat closes, and returns to rest", () => {
    const beat = [1000, 1100].reduce((b, at) => tap(b, at, BEAT), restingBeat);
    const due = commitDue(beat, 1100 + BEAT);
    expect(due.commit).toBe(2);
    expect(due.beat).toEqual(restingBeat);
  });

  it("commits nothing at rest — there is no beat to close", () => {
    expect(commitDue(restingBeat, 999_999).commit).toBe(0);
  });

  it("a tap after a commit starts a fresh beat", () => {
    const first = commitDue(tap(restingBeat, 1000, BEAT), 5000).beat;
    const second = tap(first, 6000, BEAT);
    expect(second).toEqual({ pending: 1, closesAt: 6000 + BEAT });
  });
});
