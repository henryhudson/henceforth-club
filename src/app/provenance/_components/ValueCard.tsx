export default function ValueCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="card-glow card-glow-green rounded-2xl border border-card-border bg-card-bg p-6">
      <h3 className="font-serif text-xl">{title}</h3>
      <p className="mt-2 leading-relaxed text-muted">{body}</p>
    </div>
  );
}
