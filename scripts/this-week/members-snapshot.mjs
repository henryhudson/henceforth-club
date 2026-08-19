// members-snapshot.mjs — the weekly sweep of all 650 Commons members.
//
// Henry's standing requirement (2026-08-19): each week, check every sitting
// member and report any change of status since the last snapshot. The 13
// August Clacton by-election and the 17 August Alaba suspension both happened
// in recess and were nearly missed by news search; the register catches both
// deterministically — a by-election is a new membershipStartDate, a suspension
// is a party change to Independent.
//
//   node scripts/this-week/members-snapshot.mjs           # diff vs committed, then overwrite
//   node scripts/this-week/members-snapshot.mjs --dry     # diff only, do not write
//
// The snapshot lives at scripts/this-week/members-latest.json (committed —
// public record data); git history holds every prior week.

import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { diffMembers } from "./members-diff.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SNAPSHOT = path.join(HERE, "members-latest.json");
const API = "https://members-api.parliament.uk/api/Members/Search?House=Commons&IsCurrentMember=true";

async function fetchAll() {
  const members = [];
  for (let skip = 0; ; skip += 20) {
    const res = await fetch(`${API}&skip=${skip}&take=20`);
    if (!res.ok) throw new Error(`members-api ${res.status} at skip=${skip}`);
    const page = await res.json();
    for (const it of page.items ?? []) {
      const v = it.value;
      members.push({
        id: v.id,
        name: v.nameDisplayAs,
        party: v.latestParty?.name ?? null,
        constituency: v.latestHouseMembership?.membershipFrom ?? null,
        membershipStartDate: v.latestHouseMembership?.membershipStartDate ?? null,
      });
    }
    if (members.length >= (page.totalResults ?? 0)) break;
  }
  return members.sort((a, b) => a.id - b.id);
}

const current = await fetchAll();
console.log(`fetched ${current.length} current Commons members`);

let previous = null;
try {
  previous = JSON.parse(readFileSync(SNAPSHOT, "utf8"));
} catch {
  console.log("no prior snapshot — writing the baseline");
}

if (previous) {
  const changes = diffMembers(previous.members, current);
  if (!changes.length) {
    console.log(`no changes since ${previous.taken}`);
  } else {
    console.log(`CHANGES since ${previous.taken}:`);
    for (const c of changes) console.log(`  ${c.kind}: ${c.detail}`);
  }
}

if (!process.argv.includes("--dry")) {
  writeFileSync(
    SNAPSHOT,
    JSON.stringify({ taken: new Date().toISOString().slice(0, 10), members: current }, null, 1) + "\n",
  );
  console.log(`snapshot written (${current.length} members)`);
}
