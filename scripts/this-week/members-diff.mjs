// members-diff.mjs — pure diff between two member snapshots, separated from
// the fetching script so the rules are unit-testable offline (the commit-core
// pattern). Each change is { kind, detail } with kinds:
//   departed        — an id present before, absent now (death, resignation, disqualification)
//   arrived         — an id absent before, present now (by-election winner new to the House)
//   party-change    — same id, different party (whip suspended or restored, defection)
//   re-elected      — same id, same seat, a NEW membershipStartDate (resigned and won again)
//   seat-change     — same id, different constituency (boundary or by-election move)

export function diffMembers(prev, next) {
  const before = new Map(prev.map((m) => [m.id, m]));
  const after = new Map(next.map((m) => [m.id, m]));
  const changes = [];

  for (const [id, was] of before) {
    if (!after.has(id)) {
      changes.push({ kind: "departed", detail: `${was.name} (${was.party}, ${was.constituency})` });
    }
  }
  for (const [id, now] of after) {
    const was = before.get(id);
    if (!was) {
      changes.push({ kind: "arrived", detail: `${now.name} (${now.party}, ${now.constituency})` });
      continue;
    }
    if (was.party !== now.party) {
      changes.push({ kind: "party-change", detail: `${now.name} (${now.constituency}): ${was.party} -> ${now.party}` });
    }
    if (was.constituency !== now.constituency) {
      changes.push({ kind: "seat-change", detail: `${now.name}: ${was.constituency} -> ${now.constituency}` });
    } else if (was.membershipStartDate !== now.membershipStartDate) {
      changes.push({
        kind: "re-elected",
        detail: `${now.name} (${now.constituency}): membership restarted ${String(now.membershipStartDate).slice(0, 10)}`,
      });
    }
  }
  return changes;
}
