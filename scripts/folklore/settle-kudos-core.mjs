// The once-a-day kudos settle, pure half: what each handle's accrual is
// worth in satoshis at the live rate, and what to do about it — pay, or
// skip for a named reason. The entry script beside this (settle-kudos.mjs)
// reads the store, fetches the rate and prints; nothing here touches
// either, so every rule below is asserted without a store or a network.

export const EARNED_PREFIX = "kudos:earned:";

/** The handle a `kudos:earned:<handle>` key names, or null for any other
 * key — the settled, float and duel-count families share the `kudos:`
 * prefix and must never be read as accruals. */
export function handleFromEarnedKey(key) {
  if (typeof key !== "string" || !key.startsWith(EARNED_PREFIX)) return null;
  const handle = key.slice(EARNED_PREFIX.length);
  return handle.length > 0 ? handle : null;
}

/**
 * Pure. Kudos to satoshis at `gbpPerBsv` pounds per coin, rounded DOWN — a
 * settle pays no more than was earned. `kudosPence` is the price of one
 * kudos in pence (KUDOS_PENCE, a tenth of a penny). Null when the rate is
 * unusable: no live rate, no honest number — the site's fail-closed
 * doctrine for anything priced.
 */
export function kudosToSats(kudos, gbpPerBsv, kudosPence) {
  if (!Number.isFinite(gbpPerBsv) || gbpPerBsv <= 0) return null;
  if (!Number.isFinite(kudos) || kudos <= 0) return 0;
  const pounds = (kudos * kudosPence) / 100;
  return Math.floor((pounds / gbpPerBsv) * 100_000_000);
}

/**
 * Pure. The day's batch. Each row is a handle, its accrued kudos and the
 * address its owner record binds (null when unbound); each result carries
 * the satoshis due and one action — `pay`, or a named skip. A skip leaves
 * the accrual exactly where it is, to roll into tomorrow's run: sub-dust
 * rolls (specification §6), and an unbound handle is never burned
 * (specification, Decision 6: no bound address, skip, do not burn).
 */
export function planSettlement(rows, { gbpPerBsv, kudosPence, dustSats }) {
  return rows.map(({ handle, earned, address }) => {
    const sats = kudosToSats(earned, gbpPerBsv, kudosPence);
    const row = { handle, earned, address: address ?? null, sats };
    if (sats === null) return { ...row, action: "skip-no-rate" };
    if (!(earned > 0)) return { ...row, action: "skip-nothing-earned" };
    if (!row.address) return { ...row, action: "skip-no-address" };
    if (sats < dustSats) return { ...row, action: "skip-dust" };
    return { ...row, action: "pay" };
  });
}

/** Pure. The dry run's whole output: one line per row, then the total. */
export function formatBatch(plan) {
  const lines = plan.map(
    (row) =>
      `${row.handle.padEnd(16)} earned=${row.earned} sats=${row.sats ?? "none"} address=${row.address ?? "none"} ${row.action}`,
  );
  const due = plan.filter((row) => row.action === "pay");
  const total = due.reduce((sum, row) => sum + row.sats, 0);
  return [
    ...lines,
    `${due.length} to pay, ${total} satoshis in all; ${plan.length - due.length} skipped`,
  ];
}
