// Replace the App Store listing screenshots on an EDITABLE version record with
// a freshly exported deck — the upload half the marketing pipelines never had
// (every prior update was a manual drag into the App Store Connect web page).
//
// usage:
//   node --env-file=.env.local scripts/board/asc-screenshots.mjs \
//     --app 1520654142 --version 1.30 --platform IOS \
//     --dir ~/Programming/Main/DaDeckOfCards/Tools/AppStoreScreenshots/exports/iphone \
//     [--dir <second dir> ...] [--locale en-US] [--apply]
//
// Safety model, in order:
//   1. Only a version record in an EDITABLE state is ever touched — the live
//      listing is structurally unreachable from this script.
//   2. DRY RUN BY DEFAULT: without --apply it prints the full plan and stops.
//   3. Sets are matched by the pixel dimensions of the screenshots they already
//      hold (inherited from the previous version) — display types are never
//      guessed; an unmatched size is reported and skipped, never uploaded.
//   4. Screenshots are deleted only inside a set that is being replaced, after
//      the plan is printed.
//
// Locale: screenshots upload to ONE localization (default: the app's primary
// locale). Every other localization without its own screenshots falls back to
// the primary on the store page, which is exactly how the manual drags worked.

import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { mintJWT } from "./asc-client.mjs";
import { pngDimensions, planScreenshotUpdate } from "./asc-screenshots-core.mjs";

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : fallback;
};
const has = (name) => process.argv.includes(`--${name}`);
const argAll = (name) => {
  const out = [];
  for (let i = 0; i < process.argv.length; i += 1) {
    if (process.argv[i] === `--${name}`) out.push(process.argv[i + 1]);
  }
  return out;
};

const APP_ID = arg("app");
const VERSION = arg("version");
const PLATFORM = arg("platform", "IOS");
const DIRS = argAll("dir");
const LOCALE = arg("locale");
const APPLY = has("apply");
// --assign 1320x2868=<setId>: recovery for a set whose screenshots a failed
// run already deleted (empty sets carry no dimension identity to match on).
const FORCED = Object.fromEntries(
  argAll("assign").map((s) => {
    const [size, setId] = s.split("=");
    return [size, setId];
  }),
);
if (!APP_ID || !VERSION || DIRS.length === 0) {
  console.error(
    "usage: asc-screenshots.mjs --app <appStoreId> --version <x.y> [--platform IOS|MAC_OS] --dir <exports dir> [--dir …] [--locale xx-XX] [--assign WxH=setId …] [--apply]",
  );
  process.exit(2);
}

const jwt = () =>
  mintJWT({
    issuerId: process.env.ASC_ISSUER_ID,
    keyId: process.env.ASC_KEY_ID,
    privateKeyPem: readFileSync(process.env.ASC_KEY_PATH, "utf8"),
  });

const BASE = "https://api.appstoreconnect.apple.com";
async function asc(method, path_, body) {
  const res = await fetch(`${BASE}${path_}`, {
    method,
    headers: { Authorization: `Bearer ${jwt()}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 204) return null;
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    const detail = json?.errors?.map((e) => `${e.status} ${e.code}: ${e.detail}`).join("; ") ?? res.statusText;
    throw new Error(`${method} ${path_} → ${detail}`);
  }
  return json;
}

// Same list as asc-release.mjs — the states in which a record is editable.
const EDITABLE = [
  "PREPARE_FOR_SUBMISSION",
  "DEVELOPER_REJECTED",
  "REJECTED",
  "METADATA_REJECTED",
  "INVALID_BINARY",
];

// ---- resolve the version record (and refuse anything not editable) ----
const app = await asc("GET", `/v1/apps/${APP_ID}?fields[apps]=name,primaryLocale`);
const primaryLocale = app.data.attributes.primaryLocale;
const locale = LOCALE ?? primaryLocale;

const versions = await asc(
  "GET",
  `/v1/apps/${APP_ID}/appStoreVersions?filter[platform]=${PLATFORM}&filter[versionString]=${VERSION}&limit=5`,
);
const record = versions.data?.[0];
if (!record) {
  console.error(`no ${PLATFORM} version record ${VERSION} exists for app ${APP_ID} — create it first (asc-release.mjs)`);
  process.exit(1);
}
const state = record.attributes.appStoreState;
if (!EDITABLE.includes(state)) {
  console.error(`version ${VERSION} is ${state}, not editable — refusing to touch it`);
  process.exit(1);
}
console.log(`${app.data.attributes.name} ${VERSION} (${PLATFORM}) — ${state}; uploading to locale ${locale}`);

const locs = await asc("GET", `/v1/appStoreVersions/${record.id}/appStoreVersionLocalizations?limit=200`);
const loc = locs.data.find((l) => l.attributes.locale === locale);
if (!loc) {
  console.error(`no localization ${locale} on this version — locales present: ${locs.data.map((l) => l.attributes.locale).join(", ")}`);
  process.exit(1);
}

// ---- read the sets and what they currently hold ----
const setsRes = await asc(
  "GET",
  `/v1/appStoreVersionLocalizations/${loc.id}/appScreenshotSets?include=appScreenshots&limit=50`,
);
const included = new Map((setsRes.included ?? []).map((s) => [s.id, s]));
const sets = (setsRes.data ?? []).map((s) => {
  const shots = (s.relationships?.appScreenshots?.data ?? [])
    .map((r) => included.get(r.id))
    .filter(Boolean);
  return {
    id: s.id,
    displayType: s.attributes.screenshotDisplayType,
    shotIds: shots.map((x) => x.id),
    sizes: shots
      .map((x) => [x.attributes?.imageAsset?.width, x.attributes?.imageAsset?.height])
      .filter(([w, h]) => w && h),
    count: shots.length,
  };
});

// ---- read the local decks ----
const files = [];
for (const dir of DIRS) {
  for (const name of readdirSync(dir).filter((n) => n.toLowerCase().endsWith(".png")).sort()) {
    const full = path.join(dir, name);
    const buf = readFileSync(full);
    const dims = pngDimensions(buf);
    if (!dims) {
      console.error(`not a PNG: ${full}`);
      process.exit(1);
    }
    // The apply loop looks files up by basename; a collision across --dir
    // directories would silently upload one directory's bytes into the other's
    // set (2026-08-19 review, SITE-3). The export naming embeds the pixel size
    // so collisions are always a mistake — refuse loudly.
    const clash = files.find((f) => f.name === name);
    if (clash) {
      console.error(`duplicate basename across directories: ${clash.full} and ${full}`);
      process.exit(1);
    }
    files.push({ name, full, buf, width: dims.width, height: dims.height });
  }
}

const plan = planScreenshotUpdate({
  files: files.map(({ name, width, height }) => ({ name, width, height })),
  sets,
  forced: FORCED,
});

console.log("\nPLAN");
for (const a of plan.assignments) {
  console.log(`  ${a.displayType} (${a.size}): replace ${a.replaceCount} existing with ${a.files.length} new`);
  for (const f of a.files) console.log(`    ${f}`);
}
for (const u of plan.unmatched) {
  console.log(`  SKIPPED ${u.size} (${u.files.length} files): ${u.reason}`);
}
if (plan.assignments.length === 0) {
  console.error("nothing matched — no upload possible");
  process.exit(1);
}
if (!APPLY) {
  console.log("\ndry run — pass --apply to execute");
  process.exit(0);
}

// ---- apply ----
// Print the recovery map BEFORE the first mutation: deleting a set's
// screenshots erases the dimension identity the planner matches on, so a
// failure mid-apply leaves this line as the way back in (--assign WxH=setId).
for (const a of plan.assignments) {
  console.log(`recovery map: --assign ${a.size.split("+")[0]}=${a.setId}  (${a.displayType})`);
}
const byName = new Map(files.map((f) => [f.name, f]));
for (const a of plan.assignments) {
  const set = sets.find((s) => s.id === a.setId);
  console.log(`\n${a.displayType}: deleting ${set.shotIds.length} existing screenshots`);
  for (const id of set.shotIds) await asc("DELETE", `/v1/appScreenshots/${id}`);

  const newIds = [];
  for (const name of a.files) {
    const f = byName.get(name);
    const created = await asc("POST", "/v1/appScreenshots", {
      data: {
        type: "appScreenshots",
        attributes: { fileName: f.name, fileSize: f.buf.length },
        relationships: { appScreenshotSet: { data: { type: "appScreenshotSets", id: a.setId } } },
      },
    });
    const shotId = created.data.id;
    for (const op of created.data.attributes.uploadOperations ?? []) {
      const headers = Object.fromEntries((op.requestHeaders ?? []).map((h) => [h.name, h.value]));
      const part = f.buf.subarray(op.offset, op.offset + op.length);
      const up = await fetch(op.url, { method: op.method, headers, body: part });
      if (!up.ok) throw new Error(`upload part for ${f.name} → ${up.status}`);
    }
    await asc("PATCH", `/v1/appScreenshots/${shotId}`, {
      data: {
        type: "appScreenshots",
        id: shotId,
        attributes: { uploaded: true, sourceFileChecksum: createHash("md5").update(f.buf).digest("hex") },
      },
    });
    newIds.push(shotId);
    console.log(`  uploaded ${f.name}`);
  }

  await asc("PATCH", `/v1/appScreenshotSets/${a.setId}/relationships/appScreenshots`, {
    data: newIds.map((id) => ({ type: "appScreenshots", id })),
  });
  console.log(`  ordered ${newIds.length} screenshots`);
}

// ---- verify ----
const after = await asc(
  "GET",
  `/v1/appStoreVersionLocalizations/${loc.id}/appScreenshotSets?include=appScreenshots&limit=50`,
);
const inc = new Map((after.included ?? []).map((s) => [s.id, s]));
for (const s of after.data ?? []) {
  const shots = (s.relationships?.appScreenshots?.data ?? []).map((r) => inc.get(r.id)).filter(Boolean);
  if (!shots.length) continue;
  const states = shots.map((x) => x.attributes?.assetDeliveryState?.state).join(", ");
  console.log(`${s.attributes.screenshotDisplayType}: ${shots.length} screenshots — ${states}`);
}
console.log("\ndone — processing continues on Apple's side; states above settle to COMPLETE within minutes");
