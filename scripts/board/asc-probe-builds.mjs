// One-shot: newest builds per app in ANY processing state — diagnosis for a
// quiet ship-day watcher (the release tool filters on VALID only, so a build
// still PROCESSING is invisible to it).
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
    `https://api.appstoreconnect.apple.com/v1/builds?filter[app]=${id}` +
      `&sort=-uploadedDate&limit=3&include=preReleaseVersion`,
    { headers: { Authorization: `Bearer ${jwt}` } },
  );
  const json = await res.json();
  if (!res.ok) {
    console.log(`${name}: API error`, JSON.stringify(json.errors?.[0] ?? json));
    continue;
  }
  const pre = Object.fromEntries(
    (json.included ?? []).map((i) => [i.id, i.attributes?.version]),
  );
  console.log(`== ${name}`);
  for (const b of json.data ?? []) {
    const train = pre[b.relationships?.preReleaseVersion?.data?.id] ?? "?";
    console.log(
      `  train ${train} build ${b.attributes.version} · ${b.attributes.processingState} · uploaded ${b.attributes.uploadedDate}`,
    );
  }
  if (!(json.data ?? []).length) console.log("  no builds at all");
}
