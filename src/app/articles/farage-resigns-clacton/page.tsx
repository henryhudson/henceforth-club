import type { Metadata } from "next";
import Content from "./content.mdx";

const articleTitle = "The Member for Clacton, for now";
const articleDescription =
  "Nigel Farage resigned his Clacton seat to fight it again at a by-election. What a resignation actually does to the parliamentary record — and how to watch it happen in the data.";
const articleUrl = "https://henceforth.club/articles/farage-resigns-clacton";
const articleImage = "https://henceforth.club/hansard/opengraph-image.png?v=1";

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
        alt: "The Hansard — a native iOS browser for the UK Parliament.",
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

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "Article",
  headline: articleTitle,
  description: articleDescription,
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
  datePublished: "2026-07-09",
  url: articleUrl,
};

export default function FarageResignsClactonPage() {
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
