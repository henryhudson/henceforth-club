import { estimateSingleOpReturn } from "@/lib/archiveCost";
import { estimateArchiveBytes } from "../archiveBytes";
import type { Portable } from "../source";

/**
 * The recognition-and-price card under the drop zone. `gbpPerBsv` comes from
 * the server page (live rates, hourly cache) — when it is absent the pound
 * figure is omitted rather than computed from a stale anchor: the previous
 * version multiplied by a hardcoded `GBP_PER_USD = 0.79`, which was silently
 * wrong whenever the currency moved. Fiat leads; satoshis follow — a stranger
 * knows what £0.42 is and does not know what 52,000 satoshis is.
 */
export default function CostQuote({ source, gbpPerBsv }: { source: Portable; gbpPerBsv?: number }) {
  const bytes = estimateArchiveBytes(source.archive);
  const cost = estimateSingleOpReturn(bytes);
  const pounds = gbpPerBsv === undefined ? undefined : (cost.totalSats / 1e8) * gbpPerBsv;
  const n = (v: number) => v.toLocaleString("en-GB");

  return (
    <div className="rounded-2xl border border-card-border bg-card-bg p-6">
      <div className="mb-4">
        <p className="text-sm text-foreground/90">
          {n(source.archive.posts.length)} posts, about {n(Math.round(bytes / 1024))} kilobytes on Bitcoin.
        </p>
      </div>

      <div className="mb-4 space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-muted">Miner fee</span>
          <span className="text-foreground">{n(cost.minerFeeSats)} satoshis</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted">Our reward</span>
          <span className="text-foreground">{n(cost.rewardSats)} satoshis</span>
        </div>
        <div className="flex justify-between border-t border-card-border pt-2 text-sm font-bold">
          <span className="text-muted">Total</span>
          <span className="text-foreground">
            {pounds !== undefined && `about £${pounds.toFixed(2)} — `}
            {n(cost.totalSats)} satoshis
          </span>
        </div>
      </div>

      <p className="text-xs text-muted/75">
        Pay once, readable forever. You cannot delete this later — you can only say, permanently,
        that you took it back.
      </p>
    </div>
  );
}
