import type { Metadata } from "next";
import FadeIn from "@/components/FadeIn";
import SectionNav from "@/components/SectionNav";
import { CONTENT_SECTIONS, DOCS_CHAPTERS } from "@/lib/content-nav";
import Content from "./content.mdx";

export const metadata: Metadata = {
  title: "Documentation",
  description:
    "Henceforth documentation — complete reference for all FORTH words, Bitcoin Script opcodes, wallet architecture, transaction building, and more.",
};

export default function DocsPage() {
  return (
    <div className="py-16 sm:py-24">
      <div className="mx-auto max-w-3xl px-6">
        <FadeIn>
          <SectionNav sections={CONTENT_SECTIONS} subItems={DOCS_CHAPTERS} />
        </FadeIn>
        <FadeIn delay={0.1}>
          <article className="mt-12">
            <Content />
          </article>
        </FadeIn>
      </div>
    </div>
  );
}
