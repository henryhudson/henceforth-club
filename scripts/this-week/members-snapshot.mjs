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
    const got = (page.items ?? []).length;
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
    // An ok page with zero items while more were promised is a stalled feed —
    // without this the totalResults comparison above never breaks the loop
    // (2026-08-20 review).
    if (got === 0) {
      throw new Error(
        `members-api stalled: empty page at skip=${skip} with ${members.length}/${page.totalResults} fetched`,
      );
    }
  }
  return members.sort((a, b) => a.id - b.id);
}

// The Commons seats 650; a fetch far below that is an upstream incident, not
// a mass departure. Refuse to diff or overwrite the committed baseline from a
// short list — a totalResults of 0 during an outage would otherwise flood the
// diff with departures and invert the flood on the next honest run
// (2026-08-20 review).
const MEMBER_FLOOR = 600;

const current = await fetchAll();
console.log(`fetched ${current.length} current Commons members`);
if (current.length < MEMBER_FLOOR) {
  console.error(
    `refusing to continue: ${current.length} members is below the ${MEMBER_FLOOR}-member floor — upstream incident?`,
  );
  process.exit(1);
}

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
