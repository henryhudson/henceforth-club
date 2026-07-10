import Link from "next/link";
import { getXTxid } from "@/lib/xIndex";
import { getOwner } from "@/lib/xOwner";
import { getTxDigest } from "@/lib/xDigest";
import { formatUnixSeconds, shortTxid } from "./PostCard";

/**
 * One row in the /text directory — an entry in the ledger of who has archived.
 * Reads its own extra fields with no network: the post count comes from the
 * latest transaction's cached digest only (`getTxDigest` is a cache read),
 * omitted when it hasn't been cached yet rather than fetched from chain during
 * render.
 */
export default async function DirectoryRow({ handle, latestMs }: { handle: string; latestMs: number }) {
  const latestTxid = await getXTxid(handle);
  const [owner, digest] = await Promise.all([
    getOwner(handle),
    latestTxid ? getTxDigest(latestTxid) : Promise.resolve(null),
  ]);
  const postCount = digest?.tweetIds.length;

  return (
    <div className="group flex items-center gap-4 px-4 py-4 transition-colors hover:bg-card-bg">
      <span
        aria-hidden
        className="font-mono text-sm text-card-border-hover transition-colors group-hover:text-accent"
      >
        ⛓
      </span>
      <Link href={`/text/${handle}`} className="min-w-0 flex-1">
        <p className="truncate font-semibold text-foreground transition-colors group-hover:text-accent">
          @{handle}
          {owner && (
            <span className="ml-2 font-mono text-[11px] text-accent" title="Verified — owner-signed">
              ✓ verified
            </span>
          )}
        </p>
        <p className="mt-0.5 font-mono text-[11px] text-muted">
          {formatUnixSeconds(Math.floor(latestMs / 1000))}
          {postCount !== undefined && ` · ${postCount} post${postCount === 1 ? "" : "s"}`}
        </p>
      </Link>
      {latestTxid && (
        <a
          href={`https://whatsonchain.com/tx/${latestTxid}`}
          target="_blank"
          rel="noopener noreferrer"
          title="Latest inscription on a block explorer"
          className="shrink-0 font-mono text-[11px] text-muted transition-colors hover:text-accent hover:underline"
        >
          {shortTxid(latestTxid)} ↗
        </a>
      )}
    </div>
  );
}
