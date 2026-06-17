export default function ProductChip({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-card-border bg-white px-4 py-2 text-sm font-semibold text-foreground shadow-sm">
      <span className="h-2 w-2 rounded-full bg-[#7cce2a]" aria-hidden />
      {label}
    </span>
  );
}
