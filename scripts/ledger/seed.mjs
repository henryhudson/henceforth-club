// One-time import of the converted ledger into Upstash.
//
//   node --env-file=.env.local scripts/ledger/seed.mjs
//   node --env-file=.env.local scripts/ledger/seed.mjs --force
//
// Refuses to overwrite a non-empty store. Seeding twice would append a second
// copy of every transaction and silently double the accounts, which is exactly
// the class of error this whole ledger exists to make impossible.
//
// Identifiers assigned here are permanent: an identifier is part of the
// canonical form a Merkle leaf hashes, so renumbering after a period has been
// committed would invalidate every proof drawn against it.

import { readFileSync } from "node:fs";
import { Redis } from "@upstash/redis";

const CSV_PATH =
  process.env.LEDGER_CSV ?? `${process.env.HOME}/Henceforth/ledger/transactions.csv`;

const EXPECTED_HEADER = ["date", "account", "amount", "description", "category", "source"];

/** Reader for the quoting the export actually produces: doubled quotes, no escapes. */
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') {
        quoted = false;
      } else {
        field += c;
      }
    } else if (c === '"') {
      quoted = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (c !== "\r") {
      field += c;
    }
  }
  if (field !== "" || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((f) => f !== ""));
}

const [header, ...body] = parseCsv(readFileSync(CSV_PATH, "utf8"));

if (header.join(",") !== EXPECTED_HEADER.join(",")) {
  console.error(`unexpected header in ${CSV_PATH}`);
  console.error(`  found:    ${header.join(",")}`);
  console.error(`  expected: ${EXPECTED_HEADER.join(",")}`);
  process.exit(1);
}

const transactions = body.map((cells, i) => {
  const row = Object.fromEntries(EXPECTED_HEADER.map((h, j) => [h, (cells[j] ?? "").trim()]));
  return { id: `L${String(i + 1).padStart(4, "0")}`, ...row };
});

const url = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN;
if (!url || !token) {
  console.error("no store credentials — pass --env-file with the Upstash variables");
  process.exit(1);
}
const redis = new Redis({ url, token });

const existing = await redis.get("ledger:transactions");
if (Array.isArray(existing) && existing.length > 0 && !process.argv.includes("--force")) {
  console.error(
    `store already holds ${existing.length} transactions — pass --force to replace them`,
  );
  process.exit(1);
}

await redis.set("ledger:transactions", transactions);

// Read back rather than trusting the write.
const written = await redis.get("ledger:transactions");
const pence = (a) => {
  const m = /^(-?)(\d+)\.(\d{2})$/.exec(a);
  return m ? (m[1] === "-" ? -1 : 1) * (Number(m[2]) * 100 + Number(m[3])) : 0;
};
const net = written.reduce((t, r) => t + pence(r.amount), 0);

console.log(`seeded ${written.length} transactions from ${CSV_PATH}`);
console.log(`net across all periods: ${(net / 100).toFixed(2)}`);
console.log(`first: ${written[0].id} ${written[0].date}`);
console.log(`last:  ${written.at(-1).id} ${written.at(-1).date}`);
