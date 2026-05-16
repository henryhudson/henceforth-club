import type { Metadata } from "next";
import { readFileSync } from "node:fs";
import path from "node:path";

const articleTitle = "Trust Local, But Verify";
const articleDescription =
  "How Henceforth manages UTXOs and transaction history. The wallet's source of truth is the local view of the chain that we've already verified — the network's job is to hand us new evidence; our job is to integrate that evidence additively, never to clobber stored balance because some service had a momentary stale view.";
const articleUrl = "https://henceforth.club/articles/trust-local-but-verify";
// Version-tag the og:image so X's image cache treats it as fresh when
// the underlying card is regenerated. Bump on every card re-render.
const articleImage =
  "https://henceforth.club/articles/trust-local-but-verify/opengraph-image.png?v=1";

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

// The article body is the original HTML the piece was authored against,
// with all inline SVG diagrams preserved verbatim. Read at build time
// so this stays a server component with no client JS cost.
const articleBody = readFileSync(
  path.join(process.cwd(), "src/app/articles/trust-local-but-verify/article.html"),
  "utf-8",
);

// Scoped to .tlbv-article so the article's CSS variable names (which
// collide with the site's globals.css — both define --accent, --muted)
// don't leak into the surrounding site chrome. Selectors are prefixed
// rather than the article being shadow-DOM-mounted so the inline SVG
// diagrams retain hover/scaling and the prose still inherits the site's
// header/footer layout. Visual: cream "paper" surface, monospace body —
// the article's authored look, preserved.
const scopedStyles = `
.tlbv-article {
  --bg: #fafaf8;
  --fg: #18181b;
  --tlbv-muted: #6b6b73;
  --rule: #e5e5e1;
  --aside-bg: #f4f3ee;
  --aside-border: #e5e5e1;
  --tlbv-accent: #c2410c;
  --code-bg: #f1efe8;
  --link: #c2410c;
  background: var(--bg);
  color: var(--fg);
  font-family: ui-monospace, "Space Mono", SFMono-Regular, Menlo, Monaco, monospace;
  line-height: 1.55;
  max-width: 760px;
  margin: 0 auto;
  padding: 56px 24px 96px;
  font-size: 15px;
}
.tlbv-article h1 {
  font-size: 36px;
  line-height: 1.15;
  margin: 0 0 18px;
  letter-spacing: -0.01em;
  color: var(--fg);
}
.tlbv-article h2 {
  font-size: 22px;
  margin: 56px 0 16px;
  letter-spacing: -0.005em;
  color: var(--fg);
}
.tlbv-article h3 {
  font-size: 17px;
  margin: 32px 0 10px;
  color: var(--fg);
}
.tlbv-article p { margin: 12px 0; color: var(--fg); }
.tlbv-article p strong { font-weight: 700; }
.tlbv-article p em { color: var(--tlbv-muted); }
.tlbv-article .byline { color: var(--tlbv-muted); font-style: italic; margin: 0 0 28px; }
.tlbv-article hr {
  border: none;
  border-top: 1px solid var(--rule);
  margin: 40px 0;
}
.tlbv-article aside {
  background: var(--aside-bg);
  border-left: 3px solid var(--tlbv-accent);
  padding: 14px 18px;
  margin: 18px 0;
  border-radius: 0 6px 6px 0;
  color: var(--fg);
}
.tlbv-article aside p { margin: 6px 0; }
.tlbv-article blockquote {
  border-left: 3px solid var(--rule);
  margin: 18px 0;
  padding: 4px 18px;
  color: var(--tlbv-muted);
}
.tlbv-article a {
  color: var(--link);
  text-decoration: underline;
  text-underline-offset: 3px;
}
.tlbv-article code,
.tlbv-article kbd {
  font-family: inherit;
  background: var(--code-bg);
  padding: 1px 6px;
  border-radius: 3px;
  font-size: 0.92em;
  color: var(--fg);
}
.tlbv-article pre {
  background: var(--code-bg);
  border-radius: 6px;
  padding: 14px 16px;
  overflow-x: auto;
  font-size: 0.9em;
  line-height: 1.4;
  color: var(--fg);
}
.tlbv-article pre code { background: transparent; padding: 0; }
.tlbv-article table {
  width: 100%;
  border-collapse: collapse;
  margin: 16px 0;
  font-size: 0.92em;
}
.tlbv-article th,
.tlbv-article td {
  border-bottom: 1px solid var(--rule);
  padding: 8px 10px;
  text-align: left;
  vertical-align: top;
  color: var(--fg);
}
.tlbv-article th { color: var(--tlbv-muted); font-weight: 500; }
.tlbv-article figure {
  margin: 24px 0;
  text-align: center;
}
.tlbv-article figure svg { max-width: 100%; height: auto; }
.tlbv-article figcaption {
  color: var(--tlbv-muted);
  font-size: 0.88em;
  margin-top: 8px;
  text-align: left;
  padding: 0 8px;
}
.tlbv-article ol,
.tlbv-article ul { padding-left: 22px; }
.tlbv-article li { margin: 6px 0; color: var(--fg); }
.tlbv-article .diagram-host {
  background: var(--aside-bg);
  border: 1px solid var(--aside-border);
  border-radius: 8px;
  padding: 18px;
}
.tlbv-article .diagram-host svg text {
  fill: var(--fg);
  font-family: ui-monospace, "Space Mono", monospace;
  font-size: 12px;
}
.tlbv-article .diagram-host svg .muted { fill: var(--tlbv-muted); }
.tlbv-article .diagram-host svg .accent { fill: var(--tlbv-accent); }
.tlbv-article .diagram-host svg rect.box {
  fill: #ffffff;
  stroke: #d4d4cf;
  stroke-width: 1;
}
.tlbv-article .diagram-host svg rect.boxAccent {
  fill: #fff6ec;
  stroke: var(--tlbv-accent);
  stroke-width: 1;
}
.tlbv-article .diagram-host svg path,
.tlbv-article .diagram-host svg line {
  stroke: #9a9a92;
  fill: none;
  stroke-width: 1.4;
}
.tlbv-article .diagram-host svg path.flowAccent,
.tlbv-article .diagram-host svg line.flowAccent { stroke: var(--tlbv-accent); }
`;

export default function TrustLocalButVerifyPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <style dangerouslySetInnerHTML={{ __html: scopedStyles }} />
      <div
        className="tlbv-article"
        dangerouslySetInnerHTML={{ __html: articleBody }}
      />
    </>
  );
}
