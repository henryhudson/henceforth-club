import type { Metadata } from "next";
import Content from "./content.mdx";

const articleTitle = "Trust Local, But Verify";
const articleDescription =
  "How Henceforth manages UTXOs and transaction history. The wallet's source of truth is the local view of the chain we've already verified — the network's job is to hand us new evidence, never to clobber a known-good stored balance because some service had a momentary stale view.";
const articleUrl = "https://henceforth.club/articles/trust-local-but-verify";
// Version-tag the og:image URL so X's image cache treats it as a fresh
// asset when we replace the underlying card. Bump on every re-render.
const articleImage =
  "https://henceforth.club/articles/trust-local-but-verify/opengraph-image.png?v=2";

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
        alt: "Trust Local, But Verify — how Henceforth manages UTXOs.",
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
  datePublished: "2026-05-16",
  url: articleUrl,
};

export default function TrustLocalButVerifyPage() {
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
