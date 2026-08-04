import { describe, expect, it } from "vitest";
import { validateTransaction } from "./validate";

const good = {
  id: "t1",
  date: "2025-08-19",
  account: "HSBC (debit)",
  amount: "-19.00",
  description: "GIGACLEAR WIFI",
  category: "Internet",
  source: "HSBC 2025-08-19",
};

describe("validateTransaction", () => {
  it("accepts a well-formed row", () => {
    expect(validateTransaction(good)).toEqual([]);
  });

  it("rejects a date a spreadsheet has rewritten", () => {
    const errors = validateTransaction({ ...good, date: "19/08/2025" });
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain("date");
  });

  it("rejects a date that looks well-formed but does not exist", () => {
    // 2025 is not a leap year. A regular expression alone would accept this.
    const errors = validateTransaction({ ...good, date: "2025-02-30" });
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain("date");
  });

  it("rejects an amount without two decimal places", () => {
    expect(validateTransaction({ ...good, amount: "-19" })[0]).toContain("amount");
  });

  it("rejects an empty or whitespace description", () => {
    expect(validateTransaction({ ...good, description: "" })[0]).toContain("description");
    expect(validateTransaction({ ...good, description: "   " })[0]).toContain("description");
  });

  it("rejects a date outside every accounting period", () => {
    expect(validateTransaction({ ...good, date: "2019-01-01" })[0]).toContain("period");
  });

  it("reports a malformed date as one problem, not two", () => {
    // A date that will not parse cannot also be checked for period membership.
    const errors = validateTransaction({ ...good, date: "nope" });
    expect(errors).toHaveLength(1);
  });

  it("reports every problem at once, not just the first", () => {
    const errors = validateTransaction({
      ...good, date: "nope", amount: "x", description: "",
    });
    expect(errors).toHaveLength(3);
  });

  it("tolerates entirely missing fields", () => {
    expect(validateTransaction({}).length).toBeGreaterThan(0);
  });
});
