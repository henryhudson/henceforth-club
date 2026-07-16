// Ship Henceforth macOS 4.47: wait for the uploaded build to process, create
// the MAC_OS version record, attach the build, set whatsNew, submit for review.
// Mirrors the 2026-07-15 iOS flow. Usage:
//   node --env-file=.env.local asc-mac-ship.mjs <expectedBuildNumber> [--submit]
import { mintJWT } from "../board/asc-client.mjs";
import { readFileSync } from "node:fs";

const APP = "1602896145";
const expectedBuild = process.argv[2];
const doSubmit = process.argv.includes("--submit");
if (!expectedBuild) { console.error("usage: asc-mac-ship.mjs <buildNumber> [--submit]"); process.exit(1); }

const whatsNew = readFileSync(process.argv.includes("--notes") ? process.argv[process.argv.indexOf("--notes") + 1] : new URL("./henceforth-macos-whatsnew-4.47.txt", import.meta.url), "utf8").trim();
const A = "https://api.appstoreconnect.apple.com/v1";
const auth = () => ({
  Authorization: `Bearer ${mintJWT({
    issuerId: process.env.ASC_ISSUER_ID,
    keyId: process.env.ASC_KEY_ID,
    privateKeyPem: readFileSync(process.env.ASC_KEY_PATH, "utf8"),
  })}`,
  "Content-Type": "application/json",
});
const api = async (method, path, body) => {
  const res = await fetch(`${A}${path}`, { method, headers: auth(), body: body ? JSON.stringify(body) : undefined });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status}: ${text.slice(0, 400)}`);
  return text ? JSON.parse(text) : null;
};

// 1. Wait for the uploaded build to finish processing (poll ~45 min max).
let build = null;
for (let i = 0; i < 90; i++) {
  const r = await api("GET", `/builds?filter[app]=${APP}&sort=-uploadedDate&limit=6&fields[builds]=version,processingState,uploadedDate`);
  build = (r.data ?? []).find((b) => b.attributes.version === expectedBuild) ?? null;
  const state = build?.attributes.processingState ?? "NOT_YET_VISIBLE";
  console.log(new Date().toISOString(), "build", expectedBuild, "->", state);
  if (state === "VALID") break;
  if (state === "FAILED" || state === "INVALID") throw new Error(`build processing ${state}`);
  build = null;
  await new Promise((r2) => setTimeout(r2, 30_000));
}
if (!build) throw new Error("build never became VALID — check Transporter/ASC");

// 2. MAC_OS 4.47 version record (idempotent: reuse if it already exists).
const existing = await api("GET", `/apps/${APP}/appStoreVersions?filter[platform]=MAC_OS&filter[versionString]=4.47&limit=1`);
let version = existing.data?.[0];
if (!version) {
  const created = await api("POST", "/appStoreVersions", {
    data: {
      type: "appStoreVersions",
      attributes: { platform: "MAC_OS", versionString: "4.47", releaseType: "AFTER_APPROVAL" },
      relationships: { app: { data: { type: "apps", id: APP } } },
    },
  });
  version = created.data;
  console.log("created MAC_OS 4.47 version record", version.id);
} else {
  console.log("MAC_OS 4.47 version record already exists", version.id, version.attributes.appStoreState);
}

// 3. Attach the build.
await api("PATCH", `/appStoreVersions/${version.id}/relationships/build`, {
  data: { type: "builds", id: build.id },
});
console.log("attached build", build.id, "(", expectedBuild, ")");

// 4. whatsNew on every localization (inherited from 4.46 — en-GB only).
const locs = await api("GET", `/appStoreVersions/${version.id}/appStoreVersionLocalizations`);
for (const l of locs.data ?? []) {
  await api("PATCH", `/appStoreVersionLocalizations/${l.id}`, {
    data: { type: "appStoreVersionLocalizations", id: l.id, attributes: { whatsNew } },
  });
  console.log("whatsNew set for", l.attributes.locale);
}

if (!doSubmit) { console.log("DRY: stopping before submission (pass --submit)"); process.exit(0); }

// 5. Submit for review.
const sub = await api("POST", "/reviewSubmissions", {
  data: {
    type: "reviewSubmissions",
    attributes: { platform: "MAC_OS" },
    relationships: { app: { data: { type: "apps", id: APP } } },
  },
});
await api("POST", "/reviewSubmissionItems", {
  data: {
    type: "reviewSubmissionItems",
    relationships: {
      reviewSubmission: { data: { type: "reviewSubmissions", id: sub.data.id } },
      appStoreVersion: { data: { type: "appStoreVersions", id: version.id } },
    },
  },
});
await api("PATCH", `/reviewSubmissions/${sub.data.id}`, {
  data: { type: "reviewSubmissions", id: sub.data.id, attributes: { submitted: true } },
});
console.log("SUBMITTED for review:", sub.data.id);
