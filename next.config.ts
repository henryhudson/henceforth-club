import type { NextConfig } from "next";
import { resolve } from "path";
import createMDX from "@next/mdx";

const nextConfig: NextConfig = {
  pageExtensions: ["ts", "tsx", "md", "mdx"],
  turbopack: {
    root: resolve(__dirname),
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
