import { getXTxidsBatch } from "@/lib/xIndex";
import { getOwnedHandles } from "@/lib/xOwner";
import { getTxDigests } from "@/lib/xDigest";
import { readCachedPostCounts } from "@/lib/xArchiveCache";

/** Everything one directory row renders, beyond the handle and its timestamp. */
export type DirectoryRowData = {
  latestTxid: string | null;
  verified: boolean;
  postCount?: number;
};

/**
 * The whole directory's row data in four round trips, whatever the row count.
 *
 * Each row used to fetch its own — latest txid, owner, digest, post count —
 * from inside an async server component, so a hundred-row board did four
 * hundred sequential reads and any one of them could stall the page. The reads
 * do not depend on each other across rows, so they batch: one `mget` per key
 * family, then the per-row assembly is pure.
 *
 * The digest read is second-pass because its keys are txids, which the first
 * pass discovers. Absent stays absent throughout: a handle with no cached
 * count and no digest renders without a count rather than with a zero.
 */
export async function readDirectoryRows(
  handles: string[],
): Promise<Map<string, DirectoryRowData>> {
  const rows = new Map<string, DirectoryRowData>();
  if (handles.length === 0) return rows;

  const [txidsByHandle, owned, countsByHandle] = await Promise.all([
    getXTxidsBatch(handles),
    getOwnedHandles(handles),
    readCachedPostCounts(handles),
  ]);

  const latestOf = (handle: string) => txidsByHandle.get(handle)?.at(-1) ?? null;
  const digests = await getTxDigests(
    handles.flatMap((handle) => {
      const txid = latestOf(handle);
      return txid && countsByHandle.get(handle) === undefined ? [txid] : [];
    }),
  );

  for (const handle of handles) {
    const latestTxid = latestOf(handle);
    const cached = countsByHandle.get(handle);
    const fallback = latestTxid ? digests.get(latestTxid)?.tweetIds.length : undefined;
    rows.set(handle, {
      latestTxid,
      verified: owned.has(handle),
      postCount: cached ?? fallback,
    });
  }
  return rows;
}
