import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { socialArchiveToXArchive } from "../../onchain";
import { fetchTxArchive } from "@/lib/whatsonchain";
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
  const sa = await fetchTxArchive(txid);
  if (!sa) notFound();
  return <ProfilePage archive={socialArchiveToXArchive(sa, txid)} txid={txid} />;
}
