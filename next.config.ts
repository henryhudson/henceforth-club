import type { NextConfig } from "next";
import { resolve } from "path";
import createMDX from "@next/mdx";

const nextConfig: NextConfig = {
  pageExtensions: ["ts", "tsx", "md", "mdx"],
  turbopack: {
    root: resolve(__dirname),
  },
};

// Plugins are passed as string-form (`["plugin-name"]`) so Turbopack can
// serialize them across its worker boundary. Live function imports — e.g.
// `import remarkGfm` — would break the build under Turbopack.
const withMDX = createMDX({
  options: {
    remarkPlugins: [["remark-gfm", {}]],
    rehypePlugins: [],
  },
});

export default withMDX(nextConfig);
