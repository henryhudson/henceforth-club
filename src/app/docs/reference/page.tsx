import type { Metadata } from "next";
import DocsLayout from "@/components/DocsLayout";
import { DOCS_REFERENCE_TOC } from "@/lib/content-nav";
import Content from "./content.mdx";

export const metadata: Metadata = {
  title: "Word reference",
  description:
    "Complete FORTH vocabulary and Bitcoin Script opcodes for Henceforth — stack words, networking, transaction builder, and 140+ opcodes.",
};

export default function DocsReferencePage() {
  return (
    <DocsLayout toc={DOCS_REFERENCE_TOC} accent="warm">
      <Content />
    </DocsLayout>
  );
}
