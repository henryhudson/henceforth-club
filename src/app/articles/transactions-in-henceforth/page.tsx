import type { Metadata } from "next";
import Content from "./content.mdx";

const articleTitle = "Transactions in Henceforth";
const articleDescription =
  "Three surfaces, one primitive — basic sends, multi-output payments, and raw-transaction hand-passing in the Henceforth wallet. Implementing Satoshi's framing and Wright's batching architecture.";
const articleUrl = "https://henceforth.club/articles/transactions-in-henceforth";
const articleImage = "https://henceforth.club/articles/transactions-in-henceforth/opengraph-image.png";

// Explicit openGraph + twitter blocks override the site-level defaults
// from the root layout. Without these, og:title / og:description /
// twitter:title / twitter:description / twitter:image all inherit
// "Henceforth Club" / the site-wide blurb / /cover.png — meaning X
// renders the homepage banner when the article URL is unfurled,
// regardless of the opengraph-image.png file convention setting
// og:image correctly.
export const metadata: Metadata = {
  title: articleTitle,
  description: articleDescription,
  openGraph: {
    type: "article",
    title: articleTitle,
    description: articleDescription,
    url: articleUrl,
    siteName: "Henceforth Club",
    images: [
      {
        url: articleImage,
        width: 1200,
        height: 600,
        alt: "Transactions in Henceforth — three surfaces, one primitive.",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: articleTitle,
    description: articleDescription,
    images: [articleImage],
  },
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
