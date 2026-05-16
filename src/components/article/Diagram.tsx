import type { ReactNode } from "react";

type DiagramProps = {
  caption?: ReactNode;
  // SVG payload as a string. Passed verbatim through
  // dangerouslySetInnerHTML so the class-based SVG attributes (.muted,
  // .accent, .box, .boxAccent, .flowAccent) hit the CSS rules below
  // without React's JSX-attribute munging (class → className).
  html: string;
};

// One-time inline style block. Rendered once per page (multiple
// Diagrams share); descendant-selectored to .diagram-host so the
// classes only apply inside diagrams and never leak. Values bind to
// the site's existing CSS custom properties so the diagrams pick up
// the paper theme automatically (cream surface, foreground text, orange
// accent), and inherit any future dark-mode work without changes here.
const diagramStyles = `
.diagram-host {
  background: var(--card-bg);
  border: 1px solid var(--card-border);
  border-radius: 8px;
  padding: 18px;
}
.diagram-host svg {
  display: block;
  max-width: 100%;
  height: auto;
}
.diagram-host svg text {
  fill: var(--foreground);
  font-family: ui-monospace, "Space Mono", SFMono-Regular, Menlo, monospace;
  font-size: 12px;
}
.diagram-host svg .muted { fill: var(--muted); }
.diagram-host svg .accent { fill: var(--accent-orange); }
.diagram-host svg rect.box {
  fill: var(--background);
  stroke: var(--card-border);
  stroke-width: 1;
}
.diagram-host svg rect.boxAccent {
  fill: var(--accent-orange-glow);
  stroke: var(--accent-orange);
  stroke-width: 1;
}
.diagram-host svg path,
.diagram-host svg line {
  stroke: var(--muted);
  fill: none;
  stroke-width: 1.4;
}
.diagram-host svg path.flowAccent,
.diagram-host svg line.flowAccent { stroke: var(--accent-orange); }
`;

export function Diagram({ caption, html }: DiagramProps) {
  return (
    <figure className="my-8">
      <style dangerouslySetInnerHTML={{ __html: diagramStyles }} />
      <div
        className="diagram-host"
        dangerouslySetInnerHTML={{ __html: html }}
      />
      {caption && (
        <figcaption className="mt-3 px-2 text-left text-xs leading-relaxed text-muted sm:text-sm">
          {caption}
        </figcaption>
      )}
    </figure>
  );
}
