// Press Submit for Review on an editable version record — the last human
// click of ship day, done through the Review Submissions API.
//
// usage: asc-submit.mjs --app <appStoreId> --platform IOS|MAC_OS --version <x.y>
//
// Finds the PREPARE_FOR_SUBMISSION record, opens (or reuses) a review
// submission for the platform, adds the version as its item, and submits.
// Every step reports; any API refusal prints verbatim and exits non-zero.
import { readFileSync } from "node:fs";
import { mintJWT } from "./asc-client.mjs";

const arg = (name) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
};
const APP_ID = arg("app");
const PLATFORM = arg("platform");
const VERSION = arg("version");
if (!APP_ID || !PLATFORM || !VERSION) {
  console.error("usage: asc-submit.mjs --app <id> --platform IOS|MAC_OS --version <x.y>");
  process.exit(2);
}

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
    headers: { Authorization: `Bearer ${jwt()}`, "Content-Type": "application/json" },
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

// 1. The editable version record.
const versions = await asc(
  "GET",
  `/v1/apps/${APP_ID}/appStoreVersions?filter[versionString]=${VERSION}&filter[platform]=${PLATFORM}&limit=1`,
);
const version = versions.data?.[0];
if (!version) throw new Error(`no ${PLATFORM} ${VERSION} version record found`);
console.log(`${PLATFORM} ${VERSION}: record ${version.id} · ${version.attributes.appStoreState}`);
if (version.attributes.appStoreState !== "PREPARE_FOR_SUBMISSION") {
  console.log("not in PREPARE_FOR_SUBMISSION — nothing to submit");
  process.exit(0);
}

// 2. An open review submission for this platform, reused if one exists.
const open = await asc(
  "GET",
  `/v1/apps/${APP_ID}/reviewSubmissions?filter[platform]=${PLATFORM}&filter[state]=READY_FOR_REVIEW&limit=1`,
);
let submission = open.data?.[0];
if (submission) {
  console.log(`reusing open review submission ${submission.id}`);
} else {
  const created = await asc("POST", `/v1/reviewSubmissions`, {
    data: {
      type: "reviewSubmissions",
      attributes: { platform: PLATFORM },
      relationships: { app: { data: { type: "apps", id: APP_ID } } },
    },
  });
  submission = created.data;
  console.log(`created review submission ${submission.id}`);
}

// 3. The version becomes the submission's item.
try {
  await asc("POST", `/v1/reviewSubmissionItems`, {
    data: {
      type: "reviewSubmissionItems",
      relationships: {
        reviewSubmission: { data: { type: "reviewSubmissions", id: submission.id } },
        appStoreVersion: { data: { type: "appStoreVersions", id: version.id } },
      },
    },
  });
  console.log("version added to the submission");
} catch (e) {
  if (String(e).includes("ENTITY_ERROR") || String(e).includes("already")) {
    console.log(`item add reported: ${e.message} — continuing to submit`);
  } else {
    throw e;
  }
}

// 4. Press the button.
await asc("PATCH", `/v1/reviewSubmissions/${submission.id}`, {
  data: { type: "reviewSubmissions", id: submission.id, attributes: { submitted: true } },
});
console.log("SUBMITTED for review");
