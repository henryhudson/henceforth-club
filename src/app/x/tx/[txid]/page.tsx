import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { socialArchiveToXArchive } from "../../onchain";
import { fetchTxArchiveWithTime } from "@/lib/whatsonchain";
import { countPhotos } from "@/lib/xArchiveCache";
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
  return (
    <ProfilePage
      archive={archive}
      txid={txid}
      txCount={1}
      photoCount={countPhotos(archive.posts)}
      firstInscribedAt={result.time}
      txTimes={result.time !== undefined ? { [txid]: result.time } : {}}
    />
  );
}
