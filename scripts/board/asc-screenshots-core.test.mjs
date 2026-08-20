import { describe, expect, it } from "vitest";
import { pngDimensions, planScreenshotUpdate, recoveryLines } from "./asc-screenshots-core.mjs";

describe("recoveryLines", () => {
  it("prints one --assign per orientation group of a merged mixed-orientation assignment", () => {
    const lines = recoveryLines([
      { setId: "set-ipad", displayType: "APP_IPAD_PRO_3GEN_129", size: "2064x2752+2752x2064", files: [] },
    ]);
    expect(lines).toEqual([
      "recovery map: --assign 2064x2752=set-ipad  (APP_IPAD_PRO_3GEN_129)",
      "recovery map: --assign 2752x2064=set-ipad  (APP_IPAD_PRO_3GEN_129)",
    ]);
  });

  it("prints exactly one line for a single-orientation assignment", () => {
    const lines = recoveryLines([
      { setId: "set-iphone", displayType: "APP_IPHONE_69", size: "1320x2868", files: [] },
    ]);
    expect(lines).toEqual(["recovery map: --assign 1320x2868=set-iphone  (APP_IPHONE_69)"]);
  });
});

function fakePng(width, height) {
  const buf = Buffer.alloc(24);
  buf.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
  buf.writeUInt32BE(13, 8);
  buf.write("IHDR", 12, "ascii");
  buf.writeUInt32BE(width, 16);
  buf.writeUInt32BE(height, 20);
  return buf;
}

describe("pngDimensions", () => {
  it("reads width and height from the IHDR chunk", () => {
    expect(pngDimensions(fakePng(1320, 2868))).toEqual({ width: 1320, height: 2868 });
  });
  it("returns null for a non-PNG buffer", () => {
    expect(pngDimensions(Buffer.from("definitely not a png, longer than 24 bytes"))).toBeNull();
  });
  it("returns null for a truncated buffer", () => {
    expect(pngDimensions(Buffer.alloc(10))).toBeNull();
  });
});

describe("planScreenshotUpdate", () => {
  const iphoneSet = { id: "set-iphone", displayType: "APP_IPHONE_69", sizes: [[1320, 2868]], count: 10 };
  const ipadSet = { id: "set-ipad", displayType: "APP_IPAD_PRO_129", sizes: [[2064, 2752]], count: 10 };

  it("matches each size group to the one set already holding that size", () => {
    const { assignments, unmatched } = planScreenshotUpdate({
      files: [
        { name: "02-b.png", width: 1320, height: 2868 },
        { name: "01-a.png", width: 1320, height: 2868 },
        { name: "01-a-ipad.png", width: 2064, height: 2752 },
      ],
      sets: [iphoneSet, ipadSet],
    });
    expect(unmatched).toEqual([]);
    expect(assignments).toHaveLength(2);
    const iphone = assignments.find((a) => a.setId === "set-iphone");
    expect(iphone.files).toEqual(["01-a.png", "02-b.png"]); // name order = slide order
    expect(iphone.replaceCount).toBe(10);
  });

  it("reports a size no set holds instead of guessing a display type", () => {
    const { assignments, unmatched } = planScreenshotUpdate({
      files: [{ name: "01-a.png", width: 1284, height: 2778 }],
      sets: [iphoneSet],
    });
    expect(assignments).toEqual([]);
    expect(unmatched).toHaveLength(1);
    expect(unmatched[0].reason).toContain("no screenshot set");
  });

  it("reports an ambiguous size held by two sets instead of picking one", () => {
    const twin = { ...ipadSet, id: "set-ipad-2", displayType: "APP_IPAD_OTHER", sizes: [[1320, 2868]] };
    const { assignments, unmatched } = planScreenshotUpdate({
      files: [{ name: "01-a.png", width: 1320, height: 2868 }],
      sets: [iphoneSet, twin],
    });
    expect(assignments).toEqual([]);
    expect(unmatched[0].reason).toContain("ambiguous");
  });

  it("never matches against an empty set — dimensions are the only identity", () => {
    const empty = { id: "set-empty", displayType: "APP_IPHONE_69", sizes: [], count: 0 };
    const { unmatched } = planScreenshotUpdate({
      files: [{ name: "01-a.png", width: 1320, height: 2868 }],
      sets: [empty],
    });
    expect(unmatched).toHaveLength(1);
  });

  // A set holding both orientations matches two size groups; un-merged, the
  // apply loop would delete the set once per assignment and crash on the
  // second pass (2026-08-19 review, SITE-1).
  it("collapses two size groups landing on one mixed-orientation set into a single assignment", () => {
    const mixed = { id: "set-mixed", displayType: "APP_IPHONE_69", sizes: [[1320, 2868], [2868, 1320]], count: 4 };
    const { assignments, unmatched } = planScreenshotUpdate({
      files: [
        { name: "02-landscape.png", width: 2868, height: 1320 },
        { name: "01-portrait.png", width: 1320, height: 2868 },
      ],
      sets: [mixed],
    });
    expect(unmatched).toEqual([]);
    expect(assignments).toHaveLength(1);
    expect(assignments[0].setId).toBe("set-mixed");
    expect(assignments[0].files).toEqual(["01-portrait.png", "02-landscape.png"]);
  });

  // Recovery for the stranding case: a failed run that deleted a set's
  // screenshots leaves it empty and unmatchable; --assign feeds an explicit
  // size-to-set mapping through `forced` (2026-08-19 review, SITE-2).
  it("forced mapping assigns a size group to an empty set by explicit id", () => {
    const empty = { id: "set-stranded", displayType: "APP_IPHONE_69", sizes: [], count: 0 };
    const { assignments, unmatched } = planScreenshotUpdate({
      files: [{ name: "01-a.png", width: 1320, height: 2868 }],
      sets: [empty],
      forced: { "1320x2868": "set-stranded" },
    });
    expect(unmatched).toEqual([]);
    expect(assignments).toEqual([
      { setId: "set-stranded", displayType: "APP_IPHONE_69", size: "1320x2868", files: ["01-a.png"], replaceCount: 0 },
    ]);
  });

  it("reports a forced mapping whose set id does not exist instead of guessing", () => {
    const { assignments, unmatched } = planScreenshotUpdate({
      files: [{ name: "01-a.png", width: 1320, height: 2868 }],
      sets: [iphoneSet],
      forced: { "1320x2868": "set-nonexistent" },
    });
    expect(assignments).toEqual([]);
    expect(unmatched[0].reason).toContain("does not exist");
  });
});
