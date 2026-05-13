import type { NextConfig } from "next";
import { resolve } from "path";
import createMDX from "@next/mdx";
import { HENCEFORTH_THEME } from "./src/lib/shiki-theme";

const nextConfig: NextConfig = {
  pageExtensions: ["ts", "tsx", "md", "mdx"],
  turbopack: {
    root: resolve(__dirname),
  },
};

// Plugins are passed as string-form (`["plugin-name", options]`) so
// Turbopack can serialize them across its worker boundary. The shiki
// theme is plain JSON, so it serializes fine.
const withMDX = createMDX({
  options: {
    remarkPlugins: [["remark-gfm", {}]],
    rehypePlugins: [
      [
        "rehype-pretty-code",
        {
          // Use our custom Henceforth theme: neon green base + gray
          // comments. Defined in src/lib/shiki-theme.ts.
          theme: HENCEFORTH_THEME,
          // Don't paint the panel bg from the theme — globals.css
          // already styles <pre> with our terminal-bg so the
          // Forthbox treatment stays coherent.
          keepBackground: false,
          // Single-line indicator class so we can target via CSS
          // for hover / focus highlights later if needed.
          defaultLang: "plaintext",
        },
      ],
    ],
  },
});

export default withMDX(nextConfig);
