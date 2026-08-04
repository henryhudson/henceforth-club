import { describe, expect, it } from "vitest";
import { CSV_HEADER, parsePastedRows, splitRow, toCsv } from "./csv";
import type { Transaction } from "./types";

const row = (over: Partial<Transaction> = {}): Transaction => ({
  id: "t1",
  date: "2025-02-12",
  account: "Amex (credit)",
  amount: "-429.00",
  description: "MacBook charger",
  category: "Equipment",
  source: "Statements/2025/Amex",
  ...over,
});

describe("toCsv", () => {
  it("emits exactly the six columns the converted ledger uses, in order", () => {
    const out = toCsv([row()]);
    expect(out.split("\n")[0]).toBe("date,account,amount,description,category,source");
    expect(CSV_HEADER).toHaveLength(6);
    // The identifier is deliberately absent: it is ours, not the accountant's,
    // and check.py would reject a seventh column.
    expect(out).not.toContain("t1");
  });

  it("ends with a newline so a line-wise reader sees every row", () => {
    expect(toCsv([row()]).endsWith("\n")).toBe(true);
  });

  it("quotes only the fields that need it, and doubles an embedded quote", () => {
    const out = toCsv([row({ description: 'Dinner, with "guests"' })]);
    expect(out).toContain('"Dinner, with ""guests"""');
    // The untroubled fields stay bare — quoting everything would still parse,
    // but it would make the file diff noisily against the accountant's copy.
    expect(out).toContain("2025-02-12,Amex (credit),-429.00,");
  });

  it("round-trips a quoted description back through the parser unchanged", () => {
    const original = row({ description: 'Dinner, with "guests"' });
    const [parsed] = parsePastedRows(toCsv([original]));
    expect(parsed.description).toBe(original.description);
    expect(parsed.amount).toBe("-429.00");
  });
});

describe("splitRow", () => {
  it("prefers tabs when present, so a comma inside a description is safe", () => {
    // The case this rule exists for: a statement pasted from a spreadsheet.
    const fields = splitRow("2025-02-12\tNatWest\t-19.00\tSUMUP  *COFFEE, LONDON\tEquipment\tstmt");
    expect(fields).toHaveLength(6);
    expect(fields[3]).toBe("SUMUP  *COFFEE, LONDON");
  });

  it("honours quotes when splitting on commas", () => {
    expect(splitRow('a,"b,c",d')).toEqual(["a", "b,c", "d"]);
  });

  it("trims surrounding whitespace from each field", () => {
    expect(splitRow(" a , b ")).toEqual(["a", "b"]);
  });
});

describe("parsePastedRows", () => {
  it("maps fields positionally onto the ledger columns", () => {
    const [parsed] = parsePastedRows(
      "2025-02-12\tAmex (credit)\t-429.00\tMacBook charger\tEquipment\tStatements/2025/Amex",
    );
    expect(parsed).toEqual({
      date: "2025-02-12",
      account: "Amex (credit)",
      amount: "-429.00",
      description: "MacBook charger",
      category: "Equipment",
      source: "Statements/2025/Amex",
    });
  });

  it("drops a leading header line, so re-pasting an export does not invent a bad row", () => {
    const text = "date,account,amount,description,category,source\n2025-01-02,NatWest,-19.00,Domain,Website,s";
    const rows = parsePastedRows(text);
    expect(rows).toHaveLength(1);
    expect(rows[0].date).toBe("2025-01-02");
  });

  it("ignores blank lines and tolerates carriage returns", () => {
    const rows = parsePastedRows("\r\n2025-01-02\tNatWest\t-19.00\tDomain\tWebsite\ts\r\n\r\n");
    expect(rows).toHaveLength(1);
  });

  it("pads a short row rather than dropping it, so the error is shown not hidden", () => {
    // A row missing its trailing columns is a row the operator should SEE fail
    // validation, not one that silently disappears from the review table.
    const [parsed] = parsePastedRows("2025-01-02\tNatWest\t-19.00");
    expect(parsed.description).toBe("");
    expect(parsed.source).toBe("");
  });

  it("does not validate — every parsed row reaches the single judge", () => {
    // Garbage in, garbage out BY DESIGN: validateTransaction decides what may
    // be stored. Rejecting here too would let the two rule sets drift apart.
    const rows = parsePastedRows("not-a-date\tNatWest\tnot-money\t\t\t");
    expect(rows).toHaveLength(1);
    expect(rows[0].date).toBe("not-a-date");
  });
});
