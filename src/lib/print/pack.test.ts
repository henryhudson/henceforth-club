import { describe, expect, it } from "vitest";
import { packColumns, type PackItem, type PackResult } from "./pack";

function idsInColumn(result: PackResult, column: number): string[] {
  return result.placements
    .filter((p) => p.column === column)
    .sort((a, b) => a.y - b.y)
    .map((p) => p.id);
}

function fragments(result: PackResult, id: string) {
  return result.placements.filter((p) => p.id === id).sort((a, b) => a.clipTop - b.clipTop);
}

describe("packColumns", () => {
  it("puts four equal squares in four columns, one each, and none split", () => {
    const items: PackItem[] = ["a", "b", "c", "d"].map((id) => ({ id, height: 10 }));
    const result = packColumns(items, 100);

    expect(result.placements).toHaveLength(4);
    expect(new Set(result.placements.map((p) => p.column))).toEqual(new Set([0, 1, 2, 3]));
    expect(result.placements.every((p) => p.y === 0 && p.height === 10 && p.clipTop === 0)).toBe(true);
    expect(result.splitIds).toEqual([]);
    expect(result.makespan).toBe(10);
  });

  it("places the tallest remaining square into the currently shortest column", () => {
    const items: PackItem[] = [
      { id: "short-a", height: 10 },
      { id: "tall", height: 40 },
      { id: "short-b", height: 10 },
      { id: "short-c", height: 10 },
    ];
    const result = packColumns(items, 100);

    expect(idsInColumn(result, 0)).toEqual(["tall"]);
    expect(result.columnHeights[0]).toBe(40);
    expect(result.columnHeights.slice(1).sort()).toEqual([10, 10, 10]);
    expect(result.makespan).toBe(40);
  });

  it("keeps the lead in column 0 even when a later square is taller", () => {
    const items: PackItem[] = [
      { id: "lead", height: 20, lead: true, continues: true },
      { id: "tall", height: 50 },
    ];
    const result = packColumns(items, 100);

    expect(fragments(result, "lead")[0]?.column).toBe(0);
    expect(idsInColumn(result, 0)).toEqual(["lead"]);
    expect(idsInColumn(result, 1)).toEqual(["tall"]);
  });

  it("continues a lead that is taller than the page into the next column", () => {
    const items: PackItem[] = [{ id: "lead", height: 150, lead: true, continues: true }];
    const result = packColumns(items, 100);

    const parts = fragments(result, "lead");
    expect(parts).toHaveLength(2);
    expect(parts[0]).toMatchObject({ column: 0, y: 0, height: 100, clipTop: 0 });
    expect(parts[1]).toMatchObject({ column: 1, y: 0, height: 50, clipTop: 100 });
    expect(result.splitIds).toEqual(["lead"]);
    expect(result.makespan).toBe(100);
  });

  it("cuts a continuing square only at its measured line boxes, which beat the line height", () => {
    // Copy under a 15-high heading: line boxes end at 15 + 12n.
    const cuts = [15, 27, 39, 51, 63, 75, 87, 99, 111, 123, 135, 147, 150];
    const items: PackItem[] = [{ id: "lead", height: 150, lead: true, continues: true, lineHeight: 12, cuts }];
    const result = packColumns(items, 100);

    const parts = fragments(result, "lead");
    expect(parts).toHaveLength(2);
    expect(parts[0]).toMatchObject({ column: 0, height: 99, clipTop: 0 });
    expect(parts[1]).toMatchObject({ column: 1, height: 51, clipTop: 99 });
  });

  it("skips a column when no whole line box fits its room", () => {
    const items: PackItem[] = [
      { id: "filler", height: 95 },
      { id: "lead", height: 40, lead: true, continues: true, cuts: [15, 27, 39, 40] },
    ];
    const result = packColumns(items, 100);
    const parts = fragments(result, "lead");
    expect(parts[0]?.column).toBe(0);
    expect(parts.slice(0, -1).every((p) => [15, 27, 39].includes(p.clipTop + p.height))).toBe(true);
  });

  it("cuts a continuing square on whole lines when its line height is known", () => {
    const items: PackItem[] = [{ id: "lead", height: 150, lead: true, continues: true, lineHeight: 12 }];
    const result = packColumns(items, 100);

    const parts = fragments(result, "lead");
    expect(parts).toHaveLength(2);
    expect(parts[0]).toMatchObject({ column: 0, height: 96, clipTop: 0 });
    expect(parts[1]).toMatchObject({ column: 1, height: 54, clipTop: 96 });
  });

  it("skips a column with less than one line of room rather than cutting mid-line", () => {
    const items: PackItem[] = [
      { id: "filler", height: 92 },
      { id: "lead", height: 30, lead: true, continues: true, lineHeight: 12 },
    ];
    const result = packColumns(items, 100);

    const parts = fragments(result, "lead");
    expect(parts[0]?.column).toBe(0);
    expect(parts.every((p) => p.height % 12 === 0 || p === parts[parts.length - 1])).toBe(true);
  });

  it("does not split a square that has not opted to continue; it overflows the shortest column", () => {
    const items: PackItem[] = [
      { id: "a", height: 90 },
      { id: "b", height: 90 },
      { id: "c", height: 90 },
      { id: "d", height: 90 },
      { id: "extra", height: 20 },
    ];
    const result = packColumns(items, 100);

    expect(fragments(result, "extra")).toHaveLength(1);
    expect(result.splitIds).toEqual([]);
    expect(result.makespan).toBe(110);
    expect(result.columnHeights.filter((h) => h === 110)).toHaveLength(1);
  });

  it("splits a continuing square only when it cannot sit whole in any column", () => {
    const items: PackItem[] = [
      { id: "lead", height: 80, lead: true, continues: true },
      { id: "filler", height: 90 },
      { id: "story", height: 25, continues: true },
    ];
    const result = packColumns(items, 100, 2);

    const parts = fragments(result, "story");
    expect(parts).toHaveLength(2);
    expect(parts[0]).toMatchObject({ column: 0, height: 20, clipTop: 0 });
    expect(parts[1]).toMatchObject({ column: 1, height: 5, clipTop: 20 });
    expect(parts.reduce((sum, p) => sum + p.height, 0)).toBe(25);
    expect(result.splitIds).toEqual(["story"]);
    expect(result.makespan).toBeLessThanOrEqual(100);
  });

  it("stacks several squares in one column in source order, not tallest-first", () => {
    const items: PackItem[] = [
      { id: "first", height: 10 },
      { id: "second", height: 30 },
      { id: "third", height: 10 },
    ];
    const result = packColumns(items, 100, 1);

    expect(idsInColumn(result, 0)).toEqual(["first", "second", "third"]);
    expect(fragments(result, "first")[0]?.y).toBe(0);
    expect(fragments(result, "second")[0]?.y).toBe(10);
    expect(fragments(result, "third")[0]?.y).toBe(40);
  });

  it("fits the 30 August morning squares onto one sheet without splitting the ship list across two columns", () => {
    const items: PackItem[] = [
      { id: "lead", height: 80, lead: true, continues: true },
      { id: "verdicts", height: 40 },
      { id: "plan", height: 50 },
      { id: "numbers", height: 55 },
      { id: "ship", height: 25 },
      { id: "decisions", height: 70 },
      { id: "notToday", height: 40 },
    ];
    const result = packColumns(items, 120);

    expect(result.makespan).toBeLessThanOrEqual(120);
    expect(fragments(result, "ship")).toHaveLength(1);
    expect(result.splitIds).toEqual([]);
    const shipCol = fragments(result, "ship")[0]!.column;
    const shipSiblings = idsInColumn(result, shipCol).filter((id) => id !== "ship");
    expect(shipSiblings).not.toContain("lead");
  });

  it("skips squares of no height", () => {
    const result = packColumns(
      [
        { id: "gone", height: 0 },
        { id: "kept", height: 12 },
      ],
      100,
    );
    expect(result.placements.map((p) => p.id)).toEqual(["kept"]);
  });

  it("leaves a gap between stacked squares and still fits the page", () => {
    const items: PackItem[] = [
      { id: "a", height: 10 },
      { id: "b", height: 10 },
    ];
    const result = packColumns(items, 100, 1, 5);
    expect(fragments(result, "a")[0]?.y).toBe(0);
    expect(fragments(result, "b")[0]?.y).toBe(15);
    expect(result.makespan).toBe(25);
  });

  it("returns an empty pack for no squares", () => {
    const result = packColumns([], 100);
    expect(result.placements).toEqual([]);
    expect(result.makespan).toBe(0);
    expect(result.columnHeights).toEqual([0, 0, 0, 0]);
  });
});
