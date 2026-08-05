// One-shot: current appStoreState per editable version record — "did the
// Submit button get pressed" without opening App Store Connect.
import { readFileSync } from "node:fs";
import { mintJWT } from "./asc-client.mjs";

const jwt = mintJWT({
  issuerId: process.env.ASC_ISSUER_ID,
  keyId: process.env.ASC_KEY_ID,
  privateKeyPem: readFileSync(process.env.ASC_KEY_PATH, "utf8"),
});

const APPS = [
  ["Hansard", "6762037651"],
  ["Henceforth", "1602896145"],
  ["Deck", "1520654142"],
];

for (const [name, id] of APPS) {
  const res = await fetch(
    `https://api.appstoreconnect.apple.com/v1/apps/${id}/appStoreVersions?limit=6`,
    { headers: { Authorization: `Bearer ${jwt}` } },
  );
  const json = await res.json();
  if (!res.ok) {
    console.log(`${name}: API error`, JSON.stringify(json.errors?.[0] ?? json));
    continue;
  }
  for (const v of json.data ?? []) {
    const a = v.attributes;
    console.log(`${name} ${a.platform} ${a.versionString} · ${a.appStoreState}`);
  }
}
