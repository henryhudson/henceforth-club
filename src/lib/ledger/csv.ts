import type { Transaction } from "./types";

// The two text boundaries of the ledger: what leaves as a file, and what
// arrives from a clipboard. Both are pure, because both are the parts worth
// asserting — the components around them are wiring.

/**
 * The six columns of ~/Henceforth/ledger/transactions.csv, in its order. The
 * export must round-trip through check.py, so the header is not a presentation
 * choice: it is the file's contract with the accountant's tooling.
 */
export const CSV_HEADER = [
  "date",
  "account",
  "amount",
  "description",
  "category",
  "source",
] as const;

type Column = (typeof CSV_HEADER)[number];

/** RFC 4180 quoting: only when needed, and a quote doubles itself. */
function cell(value: string): string {
  return /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export function toCsv(rows: Pick<Transaction, Column>[]): string {
  const lines = [
    CSV_HEADER.join(","),
    ...rows.map((r) => CSV_HEADER.map((h) => cell(r[h] ?? "")).join(",")),
  ];
  // Trailing newline: check.py reads line-wise, and a file whose last line has
  // no terminator is a common source of "one row short" disagreements.
  return lines.join("\n") + "\n";
}

/**
 * Split one pasted line into fields.
 *
 * Tab-separated wins whenever a tab is present, because a pasted description
 * may itself contain a comma but will never contain a tab — a bank statement
 * copied from a spreadsheet or a web table is tab-separated, and its
 * descriptions are full of commas.
 *
 * Comma splitting honours quotes so a re-pasted export survives the round trip.
 */
export function splitRow(line: string): string[] {
  if (line.includes("\t")) return line.split("\t").map((f) => f.trim());

  const fields: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"') {
        if (line[i + 1] === '"') { field += '"'; i++; } else { quoted = false; }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === ",") {
      fields.push(field.trim());
      field = "";
    } else {
      field += ch;
    }
  }
  fields.push(field.trim());
  return fields;
}

/**
 * Parse pasted text into candidate rows, positionally by `CSV_HEADER`.
 *
 * Deliberately does NOT validate: `validateTransaction` is the single judge of
 * whether a row may be stored, and duplicating its rules here would let the two
 * disagree. This only turns text into fields, so every row reaches that judge.
 *
 * A leading header line is dropped — pasting an exported file back in is a
 * normal thing to do, and treating its header as data would produce one
 * guaranteed-invalid row every time.
 */
export function parsePastedRows(text: string): Partial<Transaction>[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length && splitRow(lines[0])[0]?.toLowerCase() === "date") lines.shift();

  return lines.map((line) => {
    const fields = splitRow(line);
    const row: Partial<Transaction> = {};
    CSV_HEADER.forEach((column, i) => {
      row[column] = fields[i] ?? "";
    });
    return row;
  });
}
