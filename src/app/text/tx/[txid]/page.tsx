import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { socialArchiveToXArchive } from "../../onchain";
import { fetchTxArchiveWithTime } from "@/lib/whatsonchain";
import { countPhotos } from "@/lib/xArchiveCache";
import { getOwner } from "@/lib/xOwner";
import { readScores } from "@/lib/xVotes";
import { dedupePosts } from "../../parseArchive";
import ProfilePage from "../../_components/ProfilePage";

// Canonical, trustless view: render whatever archive lives at this exact TXID,
// read straight from the chain. No index lookup — the txid IS the address.

export async function generateMetadata(
  { params }: { params: Promise<{ txid: string }> },
): Promise<Metadata> {
  const { txid } = await params;
  return { title: `Archived profile — ${txid.slice(0, 12)}…` };
}

export default async function TxPage(
  { params }: { params: Promise<{ txid: string }> },
) {
  const { txid } = await params;
  const result = await fetchTxArchiveWithTime(txid);
  if (!result) notFound();
  const archive = socialArchiveToXArchive(result.archive, txid);
  // ProfileView dedupes posts before rendering, so the photo count needs to
  // match what's actually shown — otherwise a transaction with duplicate
  // posts (and photos riding along with them) would report a higher photo
  // count than the reader ever sees, same as the cache path already does.
  const photoCount = countPhotos(dedupePosts(archive.posts));
  const [owner, scores] = await Promise.all([
    getOwner(archive.profile.handle),
    readScores(archive.profile.handle),
  ]);
  return (
    <ProfilePage
      archive={archive}
      txid={txid}
      txCount={1}
      photoCount={photoCount}
      firstInscribedAt={result.time}
      txTimes={result.time !== undefined ? { [txid]: result.time } : {}}
      scores={scores}
      verified={owner && owner.bindingTxid === txid ? { bindingPostId: owner.bindingPostId } : undefined}
    />
  );
}
