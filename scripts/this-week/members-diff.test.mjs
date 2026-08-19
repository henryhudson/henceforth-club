import { describe, expect, it } from "vitest";
import { diffMembers } from "./members-diff.mjs";

const farage = { id: 5091, name: "Nigel Farage", party: "Reform UK", constituency: "Clacton", membershipStartDate: "2024-07-04T00:00:00" };
const alaba = { id: 5300, name: "Mr Bayo Alaba", party: "Labour", constituency: "Southend East and Rochford", membershipStartDate: "2024-07-04T00:00:00" };

describe("diffMembers", () => {
  it("reports nothing for identical snapshots", () => {
    expect(diffMembers([farage, alaba], [farage, alaba])).toEqual([]);
  });

  // The 17 August 2026 case: the whip suspended shows as Independent.
  it("reports a whip suspension as a party change", () => {
    const changes = diffMembers([alaba], [{ ...alaba, party: "Independent" }]);
    expect(changes).toHaveLength(1);
    expect(changes[0].kind).toBe("party-change");
    expect(changes[0].detail).toContain("Labour -> Independent");
  });

  // The 13 August 2026 case: resign, win the by-election, same seat, new start.
  it("reports a same-seat membership restart as re-elected", () => {
    const changes = diffMembers([farage], [{ ...farage, membershipStartDate: "2026-08-13T00:00:00" }]);
    expect(changes).toHaveLength(1);
    expect(changes[0].kind).toBe("re-elected");
    expect(changes[0].detail).toContain("2026-08-13");
  });

  it("reports departures and arrivals by member id", () => {
    const newcomer = { id: 9999, name: "A N Other", party: "Labour", constituency: "Somewhere", membershipStartDate: "2026-08-13T00:00:00" };
    const changes = diffMembers([farage], [newcomer]);
    expect(changes.map((c) => c.kind).sort()).toEqual(["arrived", "departed"]);
  });

  it("reports a seat change without also calling it a re-election", () => {
    const changes = diffMembers([farage], [{ ...farage, constituency: "Elsewhere", membershipStartDate: "2026-08-13T00:00:00" }]);
    expect(changes).toHaveLength(1);
    expect(changes[0].kind).toBe("seat-change");
  });
});
