import { describe, it, expect } from "vitest";
import { boardLooksCollapsed, collapseCounts } from "./autosync-core.mjs";
import {
  BOARD_COLLAPSED,
  FILE_MISSING,
  FILE_UNREADABLE,
  CHAIN_REFUSED,
  STORE_REFUSED,
  STORE_UNREADABLE,
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
    const reason = reasonFor(STORE_REFUSED);
    expect(reason).toContain("the store refused the write");
    expect(reason).toContain("the local file is present");
    expect(reason).not.toMatch(/missing/);
  });

  it("a refused read is not a refused write: the run held, and claims no operation it never reached", () => {
    // The board step reads the store's last good board before it writes
    // anything (the collapse guard). That read used to share the write's catch,
    // so a store that would not answer a read printed "the store refused the
    // write" about a write this run never attempted.
    const reason = reasonFor(STORE_UNREADABLE);
    expect(reason).toContain("the store could not be read");
    expect(reason).toContain("the board was held");
    expect(reason).toContain("nothing was written");
    expect(reason).not.toMatch(/refused the write/);
    expect(reason).not.toMatch(/missing/);
    const out = summarise([
      { name: "board:latest", failed: true, kind: STORE_UNREADABLE, message: "Command failed: Error: max requests limit exceeded" },
    ]);
    expect(out.exitCode).toBe(1);
    const body = out.lines.join("\n");
    expect(body).toContain("the store could not be read");
    expect(body).toContain("max requests limit exceeded");
    expect(body).not.toMatch(/refused the write/);
  });

  it("a chain refusal is its own cause, and never blamed on the file either", () => {
    const reason = reasonFor(CHAIN_REFUSED);
    expect(reason).toContain("the chain refused the inscription");
    expect(reason).toContain("the local file is present");
    expect(reason).not.toMatch(/missing/);
  });

  it("a collapsed board is refused against the store's last good one, and the run is not a publish", () => {
    // Seen live on 2026-09-07: a stray test wrote a one-card fixture over the
    // canonical file, the mirror carried it to the store within seconds and
    // the publisher put a one-card board on the chain.
    const cards = (n) => Array.from({ length: n }, (_, i) => ({ id: `c${i + 1}` }));
    const fixture = { generated: "2026-09-07 08:08 · Monday", cards: cards(1) };
    const stored = { generated: "2026-09-07 13:30 · Monday: The Counting House delivered", cards: cards(424) };
    expect(boardLooksCollapsed(fixture, stored)).toBe(true);
    const reason = reasonFor(BOARD_COLLAPSED);
    expect(reason).toContain("the store's last good board stands");
    expect(reason).not.toMatch(/missing/);
    const out = summarise([
      { name: "board:latest", failed: true, kind: BOARD_COLLAPSED, message: collapseCounts(fixture, stored) },
      { name: "board:report:2026-09-07", failed: false },
    ]);
    expect(out.exitCode).toBe(1);
    const body = out.lines.join("\n");
    expect(body).toContain(reason);
    expect(body).toContain("1 card dated 2026-09-07 08:08 against the last good 424 cards dated 2026-09-07 13:30");
  });

  it("a genuinely missing file still says so", () => {
    expect(reasonFor(FILE_MISSING)).toContain("missing");
    expect(reasonFor(FILE_UNREADABLE)).toContain("could not be read or parsed");
  });

  it("summarise exits 0 and says done when every step reached the store", () => {
    expect(summarise([{ name: "board:latest", failed: false }])).toEqual({
      exitCode: 0,
      lines: ["done"],
    });
    expect(summarise([])).toEqual({ exitCode: 0, lines: ["done"] });
  });

  it("summarise exits non-zero and names the steps that did not land", () => {
    const refused = { kind: STORE_REFUSED, message: "over quota" };
    const out = summarise([
      { name: "board:latest", failed: true, ...refused },
      { name: "board:report:2026-08-28", failed: false },
      { name: "board:gardening", failed: true, ...refused },
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
    //
    // The messages here are DISTINCT, which is the point. The Upstash client
    // has two request paths: auto-pipelining throws `Command failed: ${error}`
    // with no echo, and the two live over-quota runs that collapsed 68 and 69
    // failures into one group went that way. The direct path echoes
    // `command was: [...]`, naming the key, so every step's message differs by
    // the key it names. Grouping on the composed sentence made that one cause
    // read as sixty-eight, and only the path the client happened to take kept
    // it out of the log.
    const steps = Array.from({ length: 68 }, (_, i) => {
      const key = `board:report:2026-06-${String(i + 1).padStart(2, "0")}`;
      return {
        name: key,
        failed: true,
        kind: STORE_REFUSED,
        message: `Command failed: ERR max requests limit exceeded, command was: ["SET","${key}","{...}"]`,
      };
    });
    const out = summarise(steps);
    expect(out.exitCode).toBe(1);
    // The cause appears once, not once per step.
    expect(out.lines.filter((l) => l.includes("the store refused the write"))).toHaveLength(1);
    expect(out.lines.join("\n")).toContain("68 steps:");
    expect(out.lines.join("\n")).toContain("and 65 more");
    // One message stands for the cause, and the other wordings are counted
    // rather than dropped.
    expect(out.lines.join("\n")).toContain("and 67 other wordings");
    expect(out.lines.length).toBeLessThan(6);
  });

  it("one cause with one wording says nothing about other wordings", () => {
    const out = summarise([
      { name: "board:latest", failed: true, kind: STORE_REFUSED, message: "Command failed: ERR max requests limit exceeded" },
      { name: "board:gardening", failed: true, kind: STORE_REFUSED, message: "Command failed: ERR max requests limit exceeded" },
    ]);
    expect(out.lines.filter((l) => l.includes("the store refused the write"))).toHaveLength(1);
    expect(out.lines.join("\n")).toContain("Command failed: ERR max requests limit exceeded");
    expect(out.lines.join("\n")).not.toMatch(/other wording/);
  });

  it("distinct causes are reported separately, so none is hidden behind another", () => {
    const out = summarise([
      { name: "board:latest", failed: true, kind: STORE_REFUSED, message: "over quota" },
      { name: "board:report:2026-08-28", failed: true, kind: FILE_UNREADABLE, message: "bad json" },
    ]);
    const body = out.lines.join("\n");
    expect(body).toContain("the store refused the write");
    expect(body).toContain("could not be read or parsed");
    expect(out.lines[0]).toBe("publish FAILED — 2 of 2 step(s) did not reach the store:");
  });
});
