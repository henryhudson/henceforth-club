import type { Metadata } from "next";
import Content from "./content.mdx";

const articleTitle = "The Hansard is on the App Store";
const articleDescription =
  "A native iOS browser for the UK Parliament — every Member, every Lord, every constituency boundary, working offline from first launch. Out now for 99p.";
const articleUrl = "https://henceforth.club/articles/hansard-is-live";
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
  "@type": "TechArticle",
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
  datePublished: "2026-07-06",
  url: articleUrl,
};

export default function HansardIsLivePage() {
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
