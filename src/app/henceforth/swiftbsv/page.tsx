import type { Metadata } from "next";
import DocsLayout from "@/components/DocsLayout";
import { SWIFTBSV_TOC } from "@/lib/content-nav";
import Content from "./content.mdx";

export const metadata: Metadata = {
  title: "SwiftBSV",
  description:
    "The Swift SDK that powers every cryptographic operation in the Henceforth wallet — BIP-32/39, Type42, ECDSA, BSM, ECIES, transactions, SPV.",
};

export default function SwiftBSVPage() {
  return (
    <DocsLayout toc={SWIFTBSV_TOC} accent="warm">
      <Content />
    </DocsLayout>
  );
}
