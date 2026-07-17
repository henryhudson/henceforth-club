/**
 * The quoted price — a flat pound, stated once (the fee/premium split still
 * exists in the job record for the worker; a visitor buying permanence for
 * £1 does not need the ledger's internals itemised) — the claimed-handle
 * notice verbatim when the route sent one, and the media toggles — greyed,
 * since photos and videos are not part of this web path (v1 is text-only);
 * a visitor who wants them is pointed at the app rather than shown a
 * control that does nothing.
 */
export default function QuoteCard({
  priceSats,
  claimedNotice,
}: {
  priceSats: number;
  claimedNotice?: string;
}) {
  const n = (v: number) => v.toLocaleString("en-GB");

  return (
    <div className="rounded-2xl border border-card-border bg-card-bg p-6">
      <div className="flex items-baseline justify-between">
        <span className="text-sm text-muted">Price</span>
        <span className="text-lg font-bold text-foreground">
          &pound;1 <span className="text-sm font-normal text-muted">&middot; {n(priceSats)} satoshis at the live rate</span>
        </span>
      </div>

      {claimedNotice && <p className="mt-4 text-sm text-accent-orange">{claimedNotice}</p>}

      <div className="mt-4 space-y-2 border-t border-card-border pt-4">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted">Media</p>
        {["Images", "Videos"].map((label) => (
          <label key={label} className="flex items-center gap-2 text-sm text-muted/60">
            <input type="checkbox" disabled aria-label={`${label} — not part of the web archive`} />
            {label} —{" "}
            <a
              href="https://apps.apple.com/app/henceforth/id1602896145"
              className="text-accent hover:underline"
            >
              get the app
            </a>
          </label>
        ))}
      </div>
    </div>
  );
}
