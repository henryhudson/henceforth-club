import Link from "next/link";
import { getXTxid } from "@/lib/xIndex";
import { getArchivePage } from "@/lib/xArchiveCache";
import { getOwner } from "@/lib/xOwner";
import { getTxDigest } from "@/lib/xDigest";
import { formatUnixSeconds, shortTxid } from "./PostCard";

/**
 * One row in the /folklore directory — an entry in the ledger of who has archived.
 * The post count is the archive's TRUE total from the cache — an archive
 * spans many transactions now, and counting only the latest transaction's
 * digest told a 1,672-post archive it had "2 posts" the day after a
 * two-post delta (2026-07-16). The digest count remains the fallback for a
 * handle whose archive page hasn't been cached yet.
 */
export default async function DirectoryRow({ handle, latestMs }: { handle: string; latestMs: number }) {
  const latestTxid = await getXTxid(handle);
  const [owner, digest, page] = await Promise.all([
    getOwner(handle),
    latestTxid ? getTxDigest(latestTxid) : Promise.resolve(null),
    getArchivePage(handle, 0, 0),
  ]);
  const postCount = page?.postCount ?? digest?.tweetIds.length;

  return (
    <div className="group flex items-center gap-4 px-4 py-4 transition-colors hover:bg-card-bg">
      <span
        aria-hidden
        className="font-mono text-sm text-card-border-hover transition-colors group-hover:text-accent"
      >
        ⛓
      </span>
      <Link href={`/folklore/${handle}`} className="min-w-0 flex-1">
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
          {postCount !== undefined && ` · ${postCount.toLocaleString("en-GB")} post${postCount === 1 ? "" : "s"}`}
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
