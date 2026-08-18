// publish-taxes.mjs — push the company's complete filing record from
// ~/Henceforth/filings into Upstash so the gated /board/taxes page can serve
// it. henceforth-club is a PUBLIC repo: the documents NEVER touch git or a
// local mirror — they live only in Upstash, behind the board sign-in, same
// rule as the rest of the board data.
//
//   node --env-file=.env.local scripts/board/publish-taxes.mjs
//
// Keys:
//   board:taxes:index               -> { generated, status, periods: [{ year, period, files }] }
//   board:taxes:file:<year>:<slug>  -> { name, b64, type }
//
// `year` is the folder name under ~/Henceforth/filings (one folder per
// accounting period, plus confirmation-statements and incorporation); the
// field keeps its old name because the /board/taxes/[year]/[slug] route and
// its index check are keyed on it. `status` is read verbatim from
// filings/status.json — the machine-readable filing record (deadlines,
// per-period status, the losses chain) maintained beside the documents.

import { Redis } from "@upstash/redis";
import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";

const SOURCE = path.join(process.env.HOME, "Henceforth/filings");

// Filename -> document kind, matched on the basename. Order fixes the listing
// order on the page; unmatched files sort after these, titled from their name.
const KINDS = [
  { match: /accounts-AMENDED/i, title: "Accounts as amended (public record)" },
  { match: /accounts-as-first-filed/i, title: "Accounts as first filed (public record)" },
  { match: /accounts-filed/i, title: "Accounts as filed (public record)" },
  { match: /period-shortened/i, title: "Accounting period change notice (form AA01)" },
  { match: /filing-pack/i, title: "Filing pack — decisions and draft figures" },
  { match: /submission-runsheet/i, title: "Submission runsheet — every number to type" },
  { match: /taxes-.*-brief/i, title: "Taxes day brief" },
  { match: /CT600/i, title: "Company tax return (form CT600)" },
  { match: /Computation/i, title: "Corporation tax computation" },
  { match: /HMRC_Accounts/i, title: "Accounts filed with the tax office" },
  { match: /CH_Accounts/i, title: "Accounts filed at Companies House" },
  { match: /Trialbalance/i, title: "Trial balance" },
  { match: /confirmation-statement/i, title: "Confirmation statement" },
  { match: /incorporation/i, title: "Certificate of incorporation" },
  { match: /statement-of-capital/i, title: "Statement of capital (form SH01)" },
];

function prettify(basename) {
  return basename.replace(/\.(pdf|html)$/i, "").replace(/[-_]+/g, " ").trim();
}

function slugify(relPath) {
  return relPath
    .replace(/\.(pdf|html)$/i, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

async function collectFiles(dir, rel = "") {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const relPath = rel ? `${rel}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      out.push(...(await collectFiles(path.join(dir, entry.name), relPath)));
      continue;
    }
    if (!/\.(pdf|html)$/i.test(entry.name)) continue;
    out.push({ relPath, full: path.join(dir, entry.name), basename: entry.name });
  }
  return out;
}

const statusRaw = await readFile(path.join(SOURCE, "status.json"), "utf8").catch(() => null);
if (!statusRaw) {
  console.error(`missing ${SOURCE}/status.json — the machine-readable filing record is required`);
  process.exit(1);
}
const status = JSON.parse(statusRaw);
if (!Array.isArray(status.deadlines) || !Array.isArray(status.periods)) {
  console.error("status.json must carry deadlines[] and periods[] — refusing to publish a partial record");
  process.exit(1);
}

const labelByFolder = new Map(status.periods.map((p) => [p.folder, p.label]));
const EXTRA_LABELS = {
  "confirmation-statements": "Every filed confirmation statement",
  incorporation: "Incorporation and capital",
};

const entries = await readdir(SOURCE, { withFileTypes: true });
const periodDirs = entries
  .filter((e) => e.isDirectory() && /^\d{4}-\d{2}-\d{2}-/.test(e.name))
  .map((e) => e.name)
  .sort()
  .reverse();
const extraDirs = entries
  .filter((e) => e.isDirectory() && e.name in EXTRA_LABELS)
  .map((e) => e.name)
  .sort();
const dirs = [...periodDirs, ...extraDirs];
if (!dirs.length) {
  console.error(`no period folders under ${SOURCE}`);
  process.exit(1);
}

const periods = [];
const files = [];
for (const dirName of dirs) {
  const found = await collectFiles(path.join(SOURCE, dirName));
  const rows = [];
  for (const f of found) {
    const kindIndex = KINDS.findIndex((k) => k.match.test(f.basename));
    const nested = f.relPath.includes("/");
    const baseTitle = kindIndex >= 0 ? KINDS[kindIndex].title : prettify(f.basename);
    const title = nested && !/^working papers/i.test(baseTitle) && f.relPath.startsWith("working-papers/")
      ? `Working papers · ${baseTitle}`
      : baseTitle;
    const type = f.basename.toLowerCase().endsWith(".html") ? "html" : "pdf";
    rows.push({
      order: kindIndex < 0 ? KINDS.length : kindIndex,
      nested: nested ? 1 : 0,
      meta: {
        slug: slugify(f.relPath),
        name: f.basename,
        title,
        bytes: (await stat(f.full)).size,
        type,
      },
      b64: (await readFile(f.full)).toString("base64"),
    });
  }
  rows.sort((a, b) => a.nested - b.nested || a.order - b.order || a.meta.slug.localeCompare(b.meta.slug));
  periods.push({
    year: dirName,
    period: labelByFolder.get(dirName) ?? EXTRA_LABELS[dirName] ?? dirName,
    files: rows.map((r) => r.meta),
  });
  for (const r of rows) {
    files.push({
      key: `board:taxes:file:${dirName}:${r.meta.slug}`,
      value: { name: r.meta.name, b64: r.b64, type: r.meta.type },
    });
  }
}

const index = { generated: new Date().toISOString(), status, periods };

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
console.log(`published ${files.length} documents across ${periods.length} folders → Upstash`);
for (const p of periods) console.log(`  ${p.year} (${p.period}): ${p.files.length} files`);
