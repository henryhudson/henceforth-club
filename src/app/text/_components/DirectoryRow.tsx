import Link from "next/link";
import { getXTxid } from "@/lib/xIndex";
import { getOwner } from "@/lib/xOwner";
import { getTxDigest } from "@/lib/xDigest";
import { formatUnixSeconds } from "./PostCard";

/**
 * One row in the /text directory. Reads its own extra fields — no getRedis
 * beyond what these three calls already make, and no network: the post count
 * comes from the latest transaction's cached digest only (`getTxDigest` is a
 * cache read), omitted when it hasn't been cached yet rather than fetched
 * from chain during render.
 */
export default async function DirectoryRow({ handle, latestMs }: { handle: string; latestMs: number }) {
  const latestTxid = await getXTxid(handle);
  const [owner, digest] = await Promise.all([
    getOwner(handle),
    latestTxid ? getTxDigest(latestTxid) : Promise.resolve(null),
  ]);
  const postCount = digest?.tweetIds.length;

  return (
    <div className="flex items-center justify-between gap-4 px-5 py-3">
      <Link href={`/text/${handle}`} className="min-w-0 flex-1">
        <p className="truncate font-semibold text-foreground">
          @{handle}
          {owner && (
            <span className="ml-2 text-xs text-foreground/70" title="Verified — owner-signed">
              &#10003; Verified
            </span>
          )}
        </p>
        <p className="mt-0.5 text-xs text-muted">
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
          className="shrink-0 font-mono text-xs text-accent hover:underline"
        >
          &#9939; &#8599;
        </a>
      )}
    </div>
  );
}
