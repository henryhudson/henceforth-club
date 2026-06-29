// sync-docs.mjs — push the superpowers design docs (specs + build plans) from
// every app repo into Upstash so the gated /board/docs library serves them on
// the phone. henceforth-club is a PUBLIC repo and content/board/ is gitignored,
// so these internal docs live ONLY in Upstash (+ a local gitignored mirror for
// dev) — never in git, same rule as the board data.
//
//   node --env-file=.env.local scripts/board/sync-docs.mjs
//
// Keys:
//   board:docs:index   -> [{ id, repo, repoName, type, title, date }]  (light)
//   board:doc:<id>     -> { id, repo, repoName, type, title, date, html }

import { Redis } from "@upstash/redis";
import { readFile, readdir, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

const HOME = process.env.HOME;
const MAIN = path.join(HOME, "Programming/Main");

// repo docs dir -> board key (the per-app accent the index uses) + display name
const SOURCES = [
  { dir: path.join(MAIN, "henceforth-club/docs/superpowers"), repo: "site", name: "henceforth.club" },
  { dir: path.join(MAIN, "FORTHapp/docs/superpowers"), repo: "henceforth", name: "Henceforth" },
  { dir: path.join(MAIN, "Hansard/docs/superpowers"), repo: "hansard", name: "Hansard" },
  { dir: path.join(MAIN, "DaDeckOfCards/docs/superpowers"), repo: "deck", name: "DaDeckOfCards" },
];

// Genuine design docs only — exclude the daily /hh operational artifacts (the
// report content already lives at /board/report, the kanban IS /board).
const EXCLUDE = /morning-review-report|morning-review-dashboard|review-execution-plan|morning-board/;

const TYPES = [
  { sub: "specs", type: "spec" },
  { sub: "plans", type: "plan" },
];

function titleFrom(html, fallback) {
  const m = html.match(/<title>([^<]*)<\/title>/i);
  const t = (m ? m[1] : "").replace(/\s+/g, " ").trim();
  return t || fallback;
}
function dateFrom(name) {
  const m = name.match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : "";
}

const LOCAL = path.join(process.cwd(), "content/board/docs");

const manifest = [];
const docs = [];
for (const src of SOURCES) {
  for (const { sub, type } of TYPES) {
    let files = [];
    try {
      files = await readdir(path.join(src.dir, sub));
    } catch {
      continue; // dir may not exist for a given repo/type
    }
    for (const f of files) {
      if (!f.endsWith(".html") || EXCLUDE.test(f)) continue;
      const html = await readFile(path.join(src.dir, sub, f), "utf8");
      const base = f.replace(/\.html$/, "");
      const id = `${src.repo}/${type}/${base}`;
      const meta = { id, repo: src.repo, repoName: src.name, type, title: titleFrom(html, base), date: dateFrom(base) };
      manifest.push(meta);
      docs.push({ ...meta, html });
    }
  }
}
manifest.sort((a, b) => (b.date || "").localeCompare(a.date || ""));

// Local mirror (gitignored under content/board/) for dev fallback.
await mkdir(LOCAL, { recursive: true });
await writeFile(path.join(LOCAL, "index.json"), JSON.stringify(manifest, null, 2) + "\n");
for (const d of docs) {
  const p = path.join(LOCAL, d.id + ".json");
  await mkdir(path.dirname(p), { recursive: true });
  await writeFile(p, JSON.stringify(d) + "\n");
}
console.log(`wrote local mirror: ${docs.length} docs`);

// Upstash (the production source).
const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
if (!url || !token) {
  console.error("Upstash creds not set — wrote local mirror only (run with --env-file=.env.local to publish).");
  process.exit(0);
}
const redis = new Redis({ url, token });
const pipe = redis.pipeline();
pipe.set("board:docs:index", manifest);
for (const d of docs) pipe.set(`board:doc:${d.id}`, d);
await pipe.exec();
console.log(`synced ${docs.length} docs (${manifest.length} in manifest) → Upstash`);
