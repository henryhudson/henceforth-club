import type { Metadata } from "next";
import Content from "./content.mdx";

export const metadata: Metadata = {
  title: "Transactions in Henceforth",
  description:
    "Three surfaces, one primitive — basic sends, multi-output payments, and raw-transaction hand-passing in the Henceforth wallet. Implementing Satoshi's framing and Wright's batching architecture.",
};

// JSON-LD article schema so search engines surface the piece as a real
// article rather than a generic page. Matches the SoftwareApplication
// shape used on /henceforth.
const jsonLd = {
  "@context": "https://schema.org",
  "@type": "TechArticle",
  headline: "Transactions in Henceforth",
  description:
    "Three surfaces, one primitive — basic sends, multi-output payments, and raw-transaction hand-passing in the Henceforth wallet.",
  author: {
    "@type": "Person",
    name: "Henry Hudson",
    url: "https://x.com/henceforth_app",
  },
  publisher: {
    "@type": "Organization",
    name: "Henceforth Bitcoin Limited",
    url: "https://henceforth.club",
  },
  datePublished: "2026-05-14",
  url: "https://henceforth.club/articles/transactions-in-henceforth",
};

export default function TransactionsInHenceforthPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <div className="mx-auto max-w-3xl px-6 py-12 sm:py-16">
        <article>
          <Content />
        </article>
      </div>
    </>
  );
}
