import { estimateSingleOpReturn } from "@/lib/archiveCost";
import { estimateArchiveBytes } from "../archiveBytes";
import type { Portable } from "../source";

/** Pounds per dollar. Only ever used to soften a figure, never to compute one. */
const GBP_PER_USD = 0.79;

export default function CostQuote({ source, bsvUsd }: { source: Portable; bsvUsd?: number }) {
  const bytes = estimateArchiveBytes(source.archive);
  const cost = estimateSingleOpReturn(bytes);
  const pounds = bsvUsd === undefined ? undefined : (cost.totalSats / 1e8) * bsvUsd * GBP_PER_USD;
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
            {n(cost.totalSats)} satoshis{pounds !== undefined && ` — about £${pounds.toFixed(3)}`}
          </span>
        </div>
      </div>

      <p className="text-xs text-muted/75">
        You cannot delete this later. You can only say, permanently, that you took it back.
      </p>
    </div>
  );
}
