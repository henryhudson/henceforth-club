import { describe, expect, it } from "vitest";
import {
  EARNED_PREFIX,
  formatBatch,
  handleFromEarnedKey,
  kudosToSats,
  planSettlement,
} from "./settle-kudos-core.mjs";

// The site's own tuning — src/lib/kudos/constants.ts — restated here as the
// numbers the entry script passes in, so a change there fails these on
// purpose rather than silently.
const KUDOS_PENCE = 0.1;
const DUST_SATS = 546;
const RATE = 10; // pounds per coin — round numbers make the arithmetic legible
const tuning = { gbpPerBsv: RATE, kudosPence: KUDOS_PENCE, dustSats: DUST_SATS };
const ADDRESS = "1BoatSLRHtKNngkdXEeobR76b53LETtpyT";

describe("handleFromEarnedKey", () => {
  it("names the handle of an earned key and nothing else in the kudos namespace", () => {
    expect(handleFromEarnedKey(`${EARNED_PREFIX}henry`)).toBe("henry");
    expect(handleFromEarnedKey("kudos:settled:henry")).toBeNull();
    expect(handleFromEarnedKey("kudos:float:henry")).toBeNull();
    expect(handleFromEarnedKey(EARNED_PREFIX)).toBeNull();
    expect(handleFromEarnedKey(42)).toBeNull();
  });
});

describe("kudosToSats", () => {
  it("prices a thousand kudos — one pound — at a tenth of a ten-pound coin", () => {
    expect(kudosToSats(1_000, RATE, KUDOS_PENCE)).toBe(10_000_000);
  });

  it("rounds down, so a settle never pays more than was earned", () => {
    // One kudos at £10.76375 per coin is 9,290.46 satoshis.
    expect(kudosToSats(1, 10.76375, KUDOS_PENCE)).toBe(9_290);
  });

  it("is null without a usable rate — nothing can be priced honestly", () => {
    for (const rate of [undefined, Number.NaN, 0, -3]) {
      expect(kudosToSats(1_000, rate, KUDOS_PENCE)).toBeNull();
    }
  });

  it("is zero for nothing earned", () => {
    expect(kudosToSats(0, RATE, KUDOS_PENCE)).toBe(0);
    expect(kudosToSats(-5, RATE, KUDOS_PENCE)).toBe(0);
    expect(kudosToSats(Number.NaN, RATE, KUDOS_PENCE)).toBe(0);
  });
});

describe("planSettlement", () => {
  it("pays a bound handle whose accrual clears dust", () => {
    expect(planSettlement([{ handle: "henry", earned: 1_000, address: ADDRESS }], tuning)).toEqual([
      { handle: "henry", earned: 1_000, address: ADDRESS, sats: 10_000_000, action: "pay" },
    ]);
  });

  it("skips sub-dust, leaving the accrual to roll", () => {
    // 5 kudos is half a penny: 5,000 satoshis at £10 a coin, above dust.
    // At £100,000 a coin the same half-penny is 5 satoshis — a dearer coin
    // moves the bar up, and the accrual waits.
    const dear = { ...tuning, gbpPerBsv: 100_000 };
    expect(planSettlement([{ handle: "henry", earned: 5, address: ADDRESS }], dear)).toEqual([
      { handle: "henry", earned: 5, address: ADDRESS, sats: 5, action: "skip-dust" },
    ]);
  });

  it("skips an unbound handle without burning the accrual", () => {
    const plan = planSettlement([{ handle: "ghost", earned: 1_000, address: null }], tuning);
    expect(plan).toEqual([
      { handle: "ghost", earned: 1_000, address: null, sats: 10_000_000, action: "skip-no-address" },
    ]);
    expect(planSettlement([{ handle: "ghost", earned: 1_000 }], tuning)[0].action).toBe(
      "skip-no-address",
    );
  });

  it("skips a handle with nothing earned", () => {
    expect(planSettlement([{ handle: "quiet", earned: 0, address: ADDRESS }], tuning)[0].action).toBe(
      "skip-nothing-earned",
    );
  });

  it("skips every row when the rate is unusable, and says so", () => {
    const plan = planSettlement(
      [
        { handle: "henry", earned: 1_000, address: ADDRESS },
        { handle: "ghost", earned: 1_000, address: null },
      ],
      { ...tuning, gbpPerBsv: undefined },
    );
    expect(plan.map((row) => row.action)).toEqual(["skip-no-rate", "skip-no-rate"]);
    expect(plan.map((row) => row.sats)).toEqual([null, null]);
  });

  it("leaves its input untouched", () => {
    const rows = [{ handle: "henry", earned: 1_000, address: ADDRESS }];
    const before = JSON.stringify(rows);
    planSettlement(rows, tuning);
    expect(JSON.stringify(rows)).toBe(before);
  });
});

describe("formatBatch", () => {
  it("prints one line per row and a total that counts only what is paid", () => {
    const plan = planSettlement(
      [
        { handle: "henry", earned: 1_000, address: ADDRESS },
        { handle: "ann", earned: 300, address: ADDRESS },
        { handle: "ghost", earned: 1_000, address: null },
      ],
      tuning,
    );
    const lines = formatBatch(plan);
    expect(lines).toHaveLength(4);
    expect(lines[0]).toContain("henry");
    expect(lines[0]).toContain("sats=10000000");
    expect(lines[0]).toContain("pay");
    expect(lines[2]).toContain("skip-no-address");
    expect(lines[3]).toBe("2 to pay, 13000000 satoshis in all; 1 skipped");
  });
});
