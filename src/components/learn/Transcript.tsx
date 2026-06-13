export default function Transcript({ lines }: { lines: string[] }) {
  return (
    <details className="rounded-xl border border-card-border bg-card-bg/40 p-5">
      <summary className="cursor-pointer text-sm font-medium text-foreground">Transcript</summary>
      <ul className="mt-4 space-y-2 text-sm leading-relaxed text-muted">
        {lines.map((line, i) => (
          <li key={i}>{line}</li>
        ))}
      </ul>
    </details>
  );
}
