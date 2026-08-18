import { describe, expect, it } from "vitest";
import { pngDimensions, planScreenshotUpdate } from "./asc-screenshots-core.mjs";

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
});
