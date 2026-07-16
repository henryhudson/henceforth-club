import type { NextConfig } from "next";
import { resolve } from "path";
import createMDX from "@next/mdx";

const nextConfig: NextConfig = {
  pageExtensions: ["ts", "tsx", "md", "mdx"],
  turbopack: {
    root: resolve(__dirname),
  },
  async redirects() {
    // Both former names of this route point straight at the current one rather
    // than chaining /x → /text → /folklore. /x is not dead history: the app
    // publishes "henceforth.club/x" into real X posts (xtextWord.swift), and
    // those posts are immutable — that link has to keep landing forever.
    return [
      { source: "/x", destination: "/folklore", permanent: true },
      { source: "/x/:path*", destination: "/folklore/:path*", permanent: true },
      { source: "/text", destination: "/folklore", permanent: true },
      { source: "/text/:path*", destination: "/folklore/:path*", permanent: true },
    ];
  },
};

// Plugins must be specified as string paths (Turbopack only accepts
// serializable plugin specs). The wrapper at
// src/lib/rehype-pretty-forth.mjs is self-contained: it owns the
// custom FORTH grammar, the Henceforth shiki theme, and the lazy
// highlighter cache. Resolved to an absolute path at config-load so
// @next/mdx's dynamic import succeeds from any cwd.
const rehypePrettyForthPath = resolve(
  __dirname,
  "src/lib/rehype-pretty-forth.mjs",
);

const withMDX = createMDX({
  options: {
    remarkPlugins: [["remark-gfm", {}]],
    rehypePlugins: [[rehypePrettyForthPath]],
  },
});

export default withMDX(nextConfig);
