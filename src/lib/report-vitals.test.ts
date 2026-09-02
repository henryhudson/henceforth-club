import { describe, expect, it } from "vitest";
import { MAX_VITALS, STANDING_VITALS, questionFrom, vitalsFor } from "./report-vitals";

const cards = [
  { id: "identity", col: "review", title: "File the confirmation statement", phase: "YOU: did the identity check happen? Nine days to the filing" },
  { id: "digest", col: "review", title: "Two digests wait on a flip", phase: "YOU: flip or drop the 26 August draft" },
  { id: "pull", col: "review", title: "Something an agent can do", phase: "PULL: build it" },
  { id: "elsewhere", col: "todo", title: "Not in review", phase: "YOU: ignored, wrong column" },
];

describe("the day's vital list", () => {
  it("always ends with the standing two, even with nothing else", () => {
    const v = vitalsFor({});
    expect(v.map((x) => x.label)).toEqual(["Press-ups", "Squats"]);
    expect(v.every((x) => x.source === "standing")).toBe(true);
  });

  it("carries every board card that waits on Henry, with its question as the note", () => {
    const v = vitalsFor({ cards });
    expect(v.map((x) => x.id)).toEqual(["identity", "digest", "press-ups", "squats"]);
    expect(v[0].note).toContain("identity check");
    expect(v[0].source).toBe("board");
  });

  it("ignores a review card that is not waiting on Henry, and a YOU card in another column", () => {
    const ids = vitalsFor({ cards }).map((x) => x.id);
    expect(ids).not.toContain("pull");
    expect(ids).not.toContain("elsewhere");
  });

  it("puts the day's own items first and never repeats one the board also names", () => {
    const v = vitalsFor({ today: [{ id: "identity", label: "Do the identity check" }, { label: "Archive 4.55" }], cards });
    expect(v.map((x) => x.id)).toEqual(["identity", "archive-4-55", "digest", "press-ups", "squats"]);
    expect(v[0].label).toBe("Do the identity check");
    expect(v[0].source).toBe("today");
  });

  it("caps the list without ever dropping the standing two", () => {
    const many = Array.from({ length: 20 }, (_, i) => ({ label: `Item ${i}` }));
    const v = vitalsFor({ today: many });
    expect(v).toHaveLength(MAX_VITALS);
    expect(v.slice(-2).map((x) => x.label)).toEqual(["Press-ups", "Squats"]);
    expect(STANDING_VITALS).toHaveLength(2);
  });

  it("reads the question out of a YOU phase, and nothing out of the others", () => {
    expect(questionFrom("YOU: answer this")).toBe("answer this");
    expect(questionFrom("PULL: do this")).toBe(null);
    expect(questionFrom("YOU:")).toBe(null);
    expect(questionFrom(undefined)).toBe(null);
  });
});
