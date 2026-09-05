import { describe, it, expect } from "vitest";
import {
  parseDf, parseSwap, parseUptime, parseMemsize, parseRuntimeTotal, parseDuLines,
  consumersOf, bundleTotal, parseCount, splitSections, laptopBlock, miniBlock, round1,
} from "./machines-probe-core.mjs";

// Captured on 2026-09-04 from the laptop and the mini; the numbers below are
// what those commands printed, so a parser change that drifts fails here.
const LAPTOP_DF = `Filesystem   1024-blocks      Used Available Capacity iused     ifree %iused  Mounted on
/dev/disk3s5   482797652 437398596  17515192    97% 5106736 175151920    3%   /System/Volumes/Data
`;
const MINI_DF = `Filesystem   1024-blocks      Used Available Capacity iused      ifree %iused  Mounted on
/dev/disk3s5   482797652 210937432 243947176    47% 2063789 2439471760    0%   /System/Volumes/Data
`;
const LAPTOP_SWAP = "vm.swapusage: total = 5120.00M  used = 3678.06M  free = 1441.94M  (encrypted)\n";
const LAPTOP_UPTIME = "17:01  up 4 days, 15:14, 3 users, load averages: 2.94 2.87 2.41\n";
const MINI_UPTIME = "17:01  up 15:10, 1 user, load averages: 1.54 1.66 1.64\n";
const RUNTIME_LIST = `== Disk Images ==
-- iOS --
iOS 18.5 (22F77) - 5CBD604F-3972-46F0-93C1-02271B784EC3 (Ready)
iOS 26.4 (23E244) - 00721B02-B682-4AE0-ABB6-216F5913B600 (Ready)

Total Disk Images: 7 (56.1G)
`;
const LAPTOP_DU = `68048564\t/Users/henryhudson/Library/Developer/CoreSimulator
9383504\t/Users/henryhudson/Library/Developer/Xcode/DerivedData
745280\t/Users/henryhudson/Library/Developer/Xcode/Archives
3775440\t/Users/henryhudson/Library/Caches
`;
const MINI_WORK = `646664\t/Users/henryhudson/actions-runner-cards/_work
509576\t/Users/henryhudson/actions-runner-hansard/_work
735664\t/Users/henryhudson/actions-runner/_work
`;
const MINI_XCRESULT = `12020\t/Users/henryhudson/actions-runner-cards/_work/DaDeckOfCards/DaDeckOfCards/TestResults.xcresult
4524\t/Users/henryhudson/actions-runner-hansard/_work/Hansard/Hansard/TestResults.xcresult
104576\t/Users/henryhudson/actions-runner/_work/Henceforth/Henceforth/TestResults-ui-tests.xcresult
109116\t/Users/henryhudson/actions-runner/_work/FORTHapp/FORTHapp/TestResults-ui-tests.xcresult
`;

describe("round1", () => {
  it("rounds to one decimal", () => {
    expect(round1(16.7041)).toBe(16.7);
    expect(round1(2.95)).toBe(3);
  });
});

describe("parseDf", () => {
  it("reads size, free and the used share of the volume from the last line", () => {
    expect(parseDf(LAPTOP_DF)).toEqual({ sizeGiB: 460.4, freeGiB: 16.7, usedPct: 96.4 });
    expect(parseDf(MINI_DF)).toEqual({ sizeGiB: 460.4, freeGiB: 232.6, usedPct: 49.5 });
  });
  it("refuses output with no volume line", () => {
    expect(() => parseDf("Filesystem 1024-blocks Used Available\n")).toThrow(/df/);
  });
});

describe("parseSwap", () => {
  it("reads total and used in MiB", () => {
    expect(parseSwap(LAPTOP_SWAP)).toEqual({ totalMiB: 5120, usedMiB: 3678.1 });
  });
  it("scales gigabyte figures", () => {
    expect(parseSwap("vm.swapusage: total = 2.00G  used = 512.00M  free = 1.50G")).toEqual({ totalMiB: 2048, usedMiB: 512 });
  });
});

describe("parseUptime", () => {
  it("reads days plus hours and minutes, and the one-minute load", () => {
    expect(parseUptime(LAPTOP_UPTIME)).toEqual({ load1: 2.9, uptimeDays: 4.6 });
  });
  it("reads an uptime under a day", () => {
    expect(parseUptime(MINI_UPTIME)).toEqual({ load1: 1.5, uptimeDays: 0.6 });
  });
  it("reads the other clauses macOS writes", () => {
    expect(parseUptime("9:00  up 1 day, 2 hrs, 1 user, load averages: 0.50 0.40 0.30").uptimeDays).toBe(1.1);
    expect(parseUptime("9:00  up 23 mins, 1 user, load averages: 0.50 0.40 0.30").uptimeDays).toBe(0);
    expect(parseUptime("9:00  up 12 hrs, 2 users, load average: 0.50 0.40 0.30").uptimeDays).toBe(0.5);
  });
  it("refuses a line without a load average", () => {
    expect(() => parseUptime("9:00 up 1 day")).toThrow(/uptime/);
  });
});

describe("parseMemsize", () => {
  it("reads bytes as GiB", () => {
    expect(parseMemsize("17179869184\n")).toBe(16);
    expect(parseMemsize("8589934592\n")).toBe(8);
  });
});

describe("parseRuntimeTotal", () => {
  it("reads the total line of the runtime listing", () => {
    expect(parseRuntimeTotal(RUNTIME_LIST)).toEqual({ count: 7, gib: 56.1 });
  });
  it("is null when the listing has no total, never a zero", () => {
    expect(parseRuntimeTotal("== Disk Images ==\n")).toBeNull();
  });
});

describe("du lines", () => {
  it("parses kib and path, dropping anything else", () => {
    expect(parseDuLines(`${LAPTOP_DU}du: /Users/henryhudson/Library/Caches/CloudKit: Operation not permitted\n`)).toEqual([
      { path: "/Users/henryhudson/Library/Developer/CoreSimulator", kib: 68048564 },
      { path: "/Users/henryhudson/Library/Developer/Xcode/DerivedData", kib: 9383504 },
      { path: "/Users/henryhudson/Library/Developer/Xcode/Archives", kib: 745280 },
      { path: "/Users/henryhudson/Library/Caches", kib: 3775440 },
    ]);
  });
  it("consumersOf labels, converts to GiB and sorts largest first", () => {
    const out = consumersOf(parseDuLines(MINI_WORK), (p) => p.split("/")[3]);
    expect(out.map((c) => c.label)).toEqual(["actions-runner", "actions-runner-cards", "actions-runner-hansard"]);
    expect(out[0]).toEqual({ label: "actions-runner", path: "/Users/henryhudson/actions-runner/_work", gib: 0.7 });
  });
  it("bundleTotal counts and sums", () => {
    expect(bundleTotal(parseDuLines(MINI_XCRESULT))).toEqual({ count: 4, gib: 0.2 });
    expect(bundleTotal([])).toEqual({ count: 0, gib: 0 });
  });
});

describe("parseCount", () => {
  it("reads wc's padded count", () => {
    expect(parseCount("       3\n")).toBe(3);
  });
  it("refuses a non-count", () => {
    expect(() => parseCount("three")).toThrow(/count/);
  });
});

describe("splitSections", () => {
  it("cuts the remote output at its marker lines", () => {
    const out = splitSections("@@df\nline one\nline two\n@@swap\nvm.swapusage: x\n@@home\n/Users/henryhudson\n");
    expect(Object.keys(out)).toEqual(["df", "swap", "home"]);
    expect(out.df).toBe("line one\nline two\n");
    expect(out.home.trim()).toBe("/Users/henryhudson");
  });
  it("keeps an empty section empty", () => {
    expect(splitSections("@@work\n@@xcresult\n").xcresult).toBe("");
  });
});

describe("laptopBlock", () => {
  it("assembles the laptop's block from its captures", () => {
    const block = laptopBlock({
      readAt: "2026-09-04T16:01:00.000Z",
      df: LAPTOP_DF, swap: LAPTOP_SWAP, uptime: LAPTOP_UPTIME, memsize: "17179869184\n",
      du: LAPTOP_DU, runtimes: RUNTIME_LIST,
    });
    expect(block).toEqual({
      host: "laptop",
      readAt: "2026-09-04T16:01:00.000Z",
      data: { sizeGiB: 460.4, freeGiB: 16.7, usedPct: 96.4 },
      swap: { totalMiB: 5120, usedMiB: 3678.1 },
      memoryGiB: 16,
      load1: 2.9,
      uptimeDays: 4.6,
      consumers: [
        { label: "CoreSimulator", path: "/Users/henryhudson/Library/Developer/CoreSimulator", gib: 64.9 },
        { label: "DerivedData", path: "/Users/henryhudson/Library/Developer/Xcode/DerivedData", gib: 8.9 },
        { label: "Caches", path: "/Users/henryhudson/Library/Caches", gib: 3.6 },
        { label: "Archives", path: "/Users/henryhudson/Library/Developer/Xcode/Archives", gib: 0.7 },
      ],
      runtimes: { count: 7, gib: 56.1 },
    });
  });
  it("omits runtimes when the listing had no total", () => {
    const block = laptopBlock({
      readAt: "x", df: LAPTOP_DF, swap: LAPTOP_SWAP, uptime: LAPTOP_UPTIME, memsize: "17179869184", du: LAPTOP_DU, runtimes: "",
    });
    expect("runtimes" in block).toBe(false);
  });
  it("throws on an unreadable capture, for the caller to turn into an error block", () => {
    expect(() => laptopBlock({ readAt: "x", df: "", swap: LAPTOP_SWAP, uptime: LAPTOP_UPTIME, memsize: "1", du: "", runtimes: "" })).toThrow(/df/);
  });
});

describe("miniBlock", () => {
  const sections = splitSections(
    `@@df\n${MINI_DF}@@swap\nvm.swapusage: total = 4096.00M  used = 2409.12M  free = 1686.88M  (encrypted)\n` +
    `@@uptime\n${MINI_UPTIME}@@memsize\n8589934592\n@@work\n${MINI_WORK}@@xcresult\n${MINI_XCRESULT}@@runners\n       3\n@@home\n/Users/henryhudson\n`,
  );
  it("assembles the mini's block, labelling work trees by runner directory", () => {
    const block = miniBlock({ readAt: "2026-09-04T16:01:00.000Z", sections });
    expect(block).toEqual({
      host: "mini",
      readAt: "2026-09-04T16:01:00.000Z",
      data: { sizeGiB: 460.4, freeGiB: 232.6, usedPct: 49.5 },
      swap: { totalMiB: 4096, usedMiB: 2409.1 },
      memoryGiB: 8,
      load1: 1.5,
      uptimeDays: 0.6,
      runners: 3,
      consumers: [
        { label: "actions-runner", path: "/Users/henryhudson/actions-runner/_work", gib: 0.7 },
        { label: "actions-runner-cards", path: "/Users/henryhudson/actions-runner-cards/_work", gib: 0.6 },
        { label: "actions-runner-hansard", path: "/Users/henryhudson/actions-runner-hansard/_work", gib: 0.5 },
      ],
      xcresults: { count: 4, gib: 0.2 },
    });
  });
  it("throws when a section the block needs is missing", () => {
    const { runners: _dropped, ...without } = sections;
    expect(() => miniBlock({ readAt: "x", sections: without })).toThrow(/runners/);
  });
  it("reads no bundles as a zero count", () => {
    expect(miniBlock({ readAt: "x", sections: { ...sections, xcresult: "" } }).xcresults).toEqual({ count: 0, gib: 0 });
  });
});
