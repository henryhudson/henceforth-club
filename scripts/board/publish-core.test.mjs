import { describe, it, expect } from "vitest";
import {
  FILE_MISSING,
  FILE_UNREADABLE,
  STORE_REFUSED,
  classifyReadError,
  reasonFor,
  summarise,
} from "./publish-core.mjs";

describe("publish core", () => {
  it("classifyReadError separates an absent file from an unreadable one", () => {
    expect(classifyReadError(Object.assign(new Error("nope"), { code: "ENOENT" }))).toBe(FILE_MISSING);
    expect(classifyReadError(new SyntaxError("Unexpected token }"))).toBe(FILE_UNREADABLE);
    expect(classifyReadError(undefined)).toBe(FILE_UNREADABLE);
  });

  it("a store refusal is never described as a missing local file", () => {
    // The regression this whole module exists for: the old script printed
    // "no content/board/latest.json to publish" when the store was over quota.
    const reason = reasonFor(STORE_REFUSED, "ERR max requests limit exceeded");
    expect(reason).toContain("the store refused the write");
    expect(reason).toContain("the local file is present");
    expect(reason).not.toMatch(/missing/);
  });

  it("a genuinely missing file still says so", () => {
    expect(reasonFor(FILE_MISSING, "ENOENT")).toContain("missing");
    expect(reasonFor(FILE_UNREADABLE, "bad json")).toContain("could not be read or parsed");
  });

  it("summarise exits 0 and says done when every step reached the store", () => {
    expect(summarise([{ name: "board:latest", failed: false }])).toEqual({
      exitCode: 0,
      lines: ["done"],
    });
    expect(summarise([])).toEqual({ exitCode: 0, lines: ["done"] });
  });

  it("summarise exits non-zero and names the steps that did not land", () => {
    const refused = reasonFor(STORE_REFUSED, "over quota");
    const out = summarise([
      { name: "board:latest", failed: true, reason: refused },
      { name: "board:report:2026-08-28", failed: false },
      { name: "board:gardening", failed: true, reason: refused },
    ]);
    expect(out.exitCode).toBe(1);
    expect(out.lines[0]).toBe("publish FAILED — 2 of 3 step(s) did not reach the store:");
    const body = out.lines.join("\n");
    expect(body).toContain("board:latest");
    expect(body).toContain("board:gardening");
    expect(body).not.toContain("board:report:2026-08-28");
    expect(out.lines.at(-1)).toContain("Do not treat this run as a publish");
  });

  it("one cause taking down many steps is stated once and counted, never repeated", () => {
    // Observed live on 2026-08-28: the over-quota store failed all 68 steps and
    // the first cut of this printed the same sentence 68 times, which reads as
    // badly as silence.
    const refused = reasonFor(STORE_REFUSED, "over quota");
    const steps = Array.from({ length: 68 }, (_, i) => ({
      name: `board:report:2026-06-${String(i + 1).padStart(2, "0")}`,
      failed: true,
      reason: refused,
    }));
    const out = summarise(steps);
    expect(out.exitCode).toBe(1);
    // The reason appears once, not once per step.
    expect(out.lines.filter((l) => l.includes("the store refused the write"))).toHaveLength(1);
    expect(out.lines.join("\n")).toContain("68 steps:");
    expect(out.lines.join("\n")).toContain("and 65 more");
    expect(out.lines.length).toBeLessThan(6);
  });

  it("distinct causes are reported separately, so none is hidden behind another", () => {
    const out = summarise([
      { name: "board:latest", failed: true, reason: reasonFor(STORE_REFUSED, "over quota") },
      { name: "board:report:2026-08-28", failed: true, reason: reasonFor(FILE_UNREADABLE, "bad json") },
    ]);
    const body = out.lines.join("\n");
    expect(body).toContain("the store refused the write");
    expect(body).toContain("could not be read or parsed");
    expect(out.lines[0]).toBe("publish FAILED — 2 of 2 step(s) did not reach the store:");
  });
});
