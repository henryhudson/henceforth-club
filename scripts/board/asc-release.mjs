// Prepare an App Store release after a build upload: ensure the version
// records exist, attach the newest processed build per platform, and set the
// release notes. The human step that remains is pressing Submit for Review.
//
// Uploading a build does NOT create a version record — that is the trap this
// tool exists to close (2026-07 release ledger). Henceforth ships TWO records
// per release (IOS and MAC_OS); single-platform apps pass one --platform.
//
// usage:
//   node --env-file=.env.local scripts/board/asc-release.mjs \
//     --app 1602896145 --version 4.49 --platforms IOS,MAC_OS \
//     --whats-new-file /path/to/notes.txt [--wait]
//
// Idempotent: an existing editable version record is reused, an already
// attached build is left alone, and identical release notes are not re-sent.
// --wait polls every 60 seconds until every platform has a processed build.

import { readFileSync } from "node:fs";
import { mintJWT } from "./asc-client.mjs";

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : fallback;
};
const has = (name) => process.argv.includes(`--${name}`);

const APP_ID = arg("app");
const VERSION = arg("version");
const PLATFORMS = (arg("platforms", "IOS")).split(",");
const NOTES_FILE = arg("whats-new-file");
const WAIT = has("wait");
if (!APP_ID || !VERSION) {
  console.error("usage: asc-release.mjs --app <appStoreId> --version <x.y> [--platforms IOS,MAC_OS] [--whats-new-file notes.txt] [--wait]");
  process.exit(2);
}
const NOTES = NOTES_FILE ? readFileSync(NOTES_FILE, "utf8").trim() : null;

const jwt = () =>
  mintJWT({
    issuerId: process.env.ASC_ISSUER_ID,
    keyId: process.env.ASC_KEY_ID,
    privateKeyPem: readFileSync(process.env.ASC_KEY_PATH, "utf8"),
  });

const BASE = "https://api.appstoreconnect.apple.com";
async function asc(method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${jwt()}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 204) return null;
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    const detail = json?.errors?.map((e) => `${e.status} ${e.code}: ${e.detail}`).join("; ") ?? res.statusText;
    throw new Error(`${method} ${path} → ${detail}`);
  }
  return json;
}

// The states in which a version record is still editable — an existing record
// in any of these is reused rather than duplicated.
const EDITABLE = new Set([
  "PREPARE_FOR_SUBMISSION", "DEVELOPER_REJECTED", "REJECTED",
  "METADATA_REJECTED", "INVALID_BINARY",
]);

async function ensureVersionRecord(platform) {
  const list = await asc(
    "GET",
    `/v1/apps/${APP_ID}/appStoreVersions?filter[platform]=${platform}&limit=20`,
  );
  const existing = (list.data ?? []).find(
    (v) => v.attributes.versionString === VERSION && EDITABLE.has(v.attributes.appStoreState),
  );
  if (existing) {
    console.log(`${platform}: version record ${VERSION} exists (${existing.attributes.appStoreState})`);
    return existing;
  }
  const created = await asc("POST", "/v1/appStoreVersions", {
    data: {
      type: "appStoreVersions",
      attributes: { platform, versionString: VERSION },
      relationships: { app: { data: { type: "apps", id: APP_ID } } },
    },
  });
  console.log(`${platform}: created version record ${VERSION}`);
  return created.data;
}

async function newestProcessedBuild(platform) {
  // Builds are filtered by pre-release version string; platform is on the
  // pre-release version, so it rides the include.
  const list = await asc(
    "GET",
    `/v1/builds?filter[app]=${APP_ID}&filter[preReleaseVersion.version]=${VERSION}` +
      `&filter[preReleaseVersion.platform]=${platform}&filter[processingState]=VALID` +
      `&sort=-uploadedDate&limit=1`,
  );
  return (list.data ?? [])[0] ?? null;
}

async function attachBuild(version, build) {
  const current = await asc("GET", `/v1/appStoreVersions/${version.id}/relationships/build`);
  if (current?.data?.id === build.id) {
    console.log(`  build ${build.attributes.version} already attached`);
    return;
  }
  await asc("PATCH", `/v1/appStoreVersions/${version.id}/relationships/build`, {
    data: { type: "builds", id: build.id },
  });
  console.log(`  attached build ${build.attributes.version} (uploaded ${build.attributes.uploadedDate})`);
}

async function setWhatsNew(version) {
  if (!NOTES) return;
  const locs = await asc("GET", `/v1/appStoreVersions/${version.id}/appStoreVersionLocalizations`);
  for (const loc of locs.data ?? []) {
    if (loc.attributes.whatsNew === NOTES) {
      console.log(`  ${loc.attributes.locale}: notes already set`);
      continue;
    }
    await asc("PATCH", `/v1/appStoreVersionLocalizations/${loc.id}`, {
      data: { type: "appStoreVersionLocalizations", id: loc.id, attributes: { whatsNew: NOTES } },
    });
    console.log(`  ${loc.attributes.locale}: notes set`);
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

for (const platform of PLATFORMS) {
  const version = await ensureVersionRecord(platform);
  let build = await newestProcessedBuild(platform);
  while (!build && WAIT) {
    console.log(`${platform}: no processed ${VERSION} build yet — waiting 60s (upload from Xcode, then processing takes a few minutes)`);
    await sleep(60_000);
    build = await newestProcessedBuild(platform);
  }
  if (!build) {
    console.log(`${platform}: no processed ${VERSION} build found — upload from Xcode, then re-run (or use --wait)`);
    continue;
  }
  await attachBuild(version, build);
  await setWhatsNew(version);
  console.log(`${platform}: ready — submit for review in App Store Connect`);
}
