export default function ProductChip({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-card-border bg-card-bg px-4 py-2 text-sm">
      <span className="h-1.5 w-1.5 rounded-full bg-accent" aria-hidden />
      {label}
    </span>
  );
}
