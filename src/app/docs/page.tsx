import type { Metadata } from "next";
import DocsLayout from "@/components/DocsLayout";
import { DOCS_TOC } from "@/lib/content-nav";
import Content from "./content.mdx";

export const metadata: Metadata = {
  title: "Documentation",
  description:
    "Henceforth documentation — complete reference for all FORTH words, Bitcoin Script opcodes, wallet architecture, transaction building, and more.",
};

export default function DocsPage() {
  return (
    <DocsLayout toc={DOCS_TOC} accent="warm">
      <Content />
    </DocsLayout>
  );
}
