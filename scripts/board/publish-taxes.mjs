// publish-taxes.mjs — push the company's tax filing packs from
// ~/Henceforth/TAXES into Upstash so the gated /board/taxes page can serve
// them. henceforth-club is a PUBLIC repo: the documents NEVER touch git or a
// local mirror — they live only in Upstash, behind the board sign-in, same
// rule as the rest of the board data.
//
//   node --env-file=.env.local scripts/board/publish-taxes.mjs
//
// Keys:
//   board:taxes:index              -> { generated, periods: [{ year, period, files }] }
//   board:taxes:file:<year>:<slug> -> { name, b64 }

import { Redis } from "@upstash/redis";
import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";

const SOURCE = path.join(process.env.HOME, "Henceforth/TAXES");

// Accounting periods read off each folder's CT600 (box 30/35) — the
// accountant's filenames all say 2024, the folders are filing years.
const PERIODS = {
  2023: "1 February 2023 to 31 January 2024",
  2024: "1 February 2024 to 31 December 2024",
};

// Filename -> document kind. Order fixes the listing order on the page.
const KINDS = [
  { match: /CT600/i, slug: "ct600", title: "CT600 — Company Tax Return" },
  { match: /Computation/i, slug: "computation", title: "Corporation Tax computation" },
  { match: /HMRC_Accounts/i, slug: "hmrc-accounts", title: "Accounts filed with HMRC" },
  { match: /CH_Accounts/i, slug: "companies-house-accounts", title: "Accounts filed at Companies House" },
  { match: /Trialbalance/i, slug: "trial-balance", title: "Trial balance" },
];

const years = (await readdir(SOURCE)).filter((d) => /^\d{4}$/.test(d)).sort().reverse();
if (!years.length) {
  console.error(`no year folders under ${SOURCE}`);
  process.exit(1);
}

const periods = [];
const files = [];
for (const year of years) {
  const dir = path.join(SOURCE, year);
  const entries = [];
  for (const name of await readdir(dir)) {
    if (!name.toLowerCase().endsWith(".pdf")) continue;
    const kindIndex = KINDS.findIndex((k) => k.match.test(name));
    const kind = KINDS[kindIndex] ?? {
      slug: name.replace(/\.pdf$/i, "").toLowerCase().replace(/[^a-z0-9]+/g, "-"),
      title: name.replace(/\.pdf$/i, ""),
    };
    const full = path.join(dir, name);
    const bytes = (await stat(full)).size;
    entries.push({
      order: kindIndex < 0 ? KINDS.length : kindIndex,
      meta: { slug: kind.slug, name, title: kind.title, bytes },
      b64: (await readFile(full)).toString("base64"),
    });
  }
  entries.sort((a, b) => a.order - b.order);
  periods.push({
    year,
    period: PERIODS[year] ?? `filing year ${year}`,
    files: entries.map((e) => e.meta),
  });
  for (const e of entries) {
    files.push({ key: `board:taxes:file:${year}:${e.meta.slug}`, value: { name: e.meta.name, b64: e.b64 } });
  }
}

const index = { generated: new Date().toISOString(), periods };

const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
if (!url || !token) {
  console.error("Upstash creds not set — run with --env-file=.env.local. Nothing published.");
  process.exit(1);
}
const redis = new Redis({ url, token });
const pipe = redis.pipeline();
pipe.set("board:taxes:index", index);
for (const f of files) pipe.set(f.key, f.value);
await pipe.exec();
console.log(
  `published ${files.length} documents across ${periods.length} periods → Upstash`,
);
for (const p of periods) console.log(`  ${p.year} (${p.period}): ${p.files.length} files`);
