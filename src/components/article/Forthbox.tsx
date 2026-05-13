import type { ReactNode } from "react";

type ForthboxProps = {
  title?: string;
  children: ReactNode;
};

// Titled terminal-style example block. Mirrors the LaTeX `forthbox`
// environment: rectangular orange title chip straddling the top edge
// of a dark terminal panel (half above, half overlapping the panel),
// green mono content inside. The inner <pre> styling lives in
// mdx-components — this component just adds the title chip.
//
// Geometry: `translate-y-1/2` moves the chip down by 50% of its own
// height without affecting layout, so the chip's centerline aligns
// exactly with the panel's top edge. The `relative z-10` lifts the
// chip above the panel so its overlapping half stays visible.
export function Forthbox({ title, children }: ForthboxProps) {
  return (
    <div className="my-8">
      {title && (
        <div className="relative z-10 ml-3 inline-block translate-y-1/2 bg-accent-orange px-3.5 py-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-background shadow-md shadow-black/50">
          {title}
        </div>
      )}
      <div className="[&>pre]:mt-0">{children}</div>
    </div>
  );
}
