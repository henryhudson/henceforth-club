import type { Metadata } from "next";
import DocsLayout from "@/components/DocsLayout";
import { DOCS_WALLET_TOC } from "@/lib/content-nav";
import Content from "./content.mdx";

export const metadata: Metadata = {
  title: "Wallet documentation",
  description:
    "How the Bitcoin SV wallet inside Henceforth is built — architecture, transactions, SPV, cold mode, UTXO sync, and security.",
};

export default function DocsWalletPage() {
  return (
    <DocsLayout toc={DOCS_WALLET_TOC} accent="warm">
      <Content />
    </DocsLayout>
  );
}
