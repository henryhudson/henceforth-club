import Image from "next/image";

type ScreenshotProps = {
  src: string;
  alt: string;
  /** Display width in px. Defaults to 320 — comfortable phone-in-print
   *  scale inside the max-w-3xl article container. */
  width?: number;
};

// Portrait phone-screenshot figure with caption. Designed for iOS
// screenshots (~1320×2868 native) displayed at ~320px wide so a 3×
// retina screenshot still renders crisp without dominating the cream
// article column. Uses next/image so Vercel serves WebP/AVIF at the
// right size — the source PNGs would otherwise burn ~250–550 KB each
// for content displayed at a quarter their native width.
export function Screenshot({ src, alt, width = 320 }: ScreenshotProps) {
  // Preserve iPhone aspect ratio (~1320×2868). Computing height from the
  // canonical ratio keeps the rounded border tight to the device frame.
  const height = Math.round(width * (2868 / 1320));
  return (
    <figure className="my-10 flex flex-col items-center">
      <Image
        src={src}
        alt={alt}
        width={width}
        height={height}
        className="rounded-2xl border border-card-border shadow-xl shadow-black/15"
      />
      <figcaption className="mt-3 max-w-prose px-4 text-center text-xs text-muted">
        {alt}
      </figcaption>
    </figure>
  );
}
