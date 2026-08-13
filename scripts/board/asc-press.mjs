// Press "Release this version" on an approved record sitting at
// PENDING_DEVELOPER_RELEASE — the one tap 1.6 waited three days for
// (2026-08-06..08). Resolves the record fresh so a stale id can never
// release the wrong version.
//
// usage: node --env-file=.env.local scripts/board/asc-press.mjs --app <appStoreId> --version <x.y> [--platform IOS]

import { readFileSync } from "node:fs";
import { mintJWT } from "./asc-client.mjs";

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : fallback;
};
const APP_ID = arg("app");
const VERSION = arg("version");
const PLATFORM = arg("platform", "IOS");
if (!APP_ID || !VERSION) {
  console.error("usage: asc-press.mjs --app <appStoreId> --version <x.y> [--platform IOS|MAC_OS]");
  process.exit(2);
}

const jwt = mintJWT({
  issuerId: process.env.ASC_ISSUER_ID,
  keyId: process.env.ASC_KEY_ID,
  privateKeyPem: readFileSync(process.env.ASC_KEY_PATH, "utf8"),
});
const BASE = "https://api.appstoreconnect.apple.com/v1";
const headers = { Authorization: `Bearer ${jwt}`, "Content-Type": "application/json" };

const list = await fetch(
  `${BASE}/apps/${APP_ID}/appStoreVersions?filter[versionString]=${VERSION}&filter[platform]=${PLATFORM}&limit=5`,
  { headers },
).then((r) => r.json());

const record = (list.data ?? []).find((v) => v.attributes?.appStoreState === "PENDING_DEVELOPER_RELEASE");
if (!record) {
  const states = (list.data ?? []).map((v) => `${v.attributes?.versionString} · ${v.attributes?.appStoreState}`);
  console.error(`no PENDING_DEVELOPER_RELEASE record for ${VERSION} ${PLATFORM} — found: ${states.join(", ") || "none"}`);
  process.exit(1);
}
console.log(`${PLATFORM} ${VERSION}: record ${record.id} · PENDING_DEVELOPER_RELEASE`);

const res = await fetch(`${BASE}/appStoreVersionReleaseRequests`, {
  method: "POST",
  headers,
  body: JSON.stringify({
    data: {
      type: "appStoreVersionReleaseRequests",
      relationships: { appStoreVersion: { data: { type: "appStoreVersions", id: record.id } } },
    },
  }),
});
if (!res.ok) {
  console.error(`release request refused (${res.status}): ${await res.text()}`);
  process.exit(1);
}
console.log("RELEASE REQUESTED — the version leaves PENDING_DEVELOPER_RELEASE on Apple's next tick");
