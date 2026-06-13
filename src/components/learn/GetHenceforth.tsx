const APP_STORE = "https://apps.apple.com/app/henceforth/id1602896145";

export default function GetHenceforth() {
  return (
    <div className="rounded-xl border border-accent-warm/30 bg-card-bg/40 p-5">
      <p className="text-xs uppercase tracking-widest text-accent-warm/80">
        Watch here · code in the app
      </p>
      <p className="mt-2 text-sm leading-relaxed text-muted">
        Henceforth is the real terminal — one purchase ($9.99) for iPhone, iPad and Mac.
        Type the commands below into the app as you watch.
      </p>
      <div className="mt-4 flex flex-wrap gap-3">
        <a
          href={APP_STORE}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-lg border border-accent-warm/50 px-4 py-2 text-sm font-medium text-foreground transition-colors hover:border-accent-warm hover:text-accent-warm"
        >
          App Store ↗
        </a>
        <a
          href={APP_STORE}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-lg border border-card-border px-4 py-2 text-sm font-medium text-muted transition-colors hover:border-accent-warm hover:text-accent-warm"
        >
          Mac App Store ↗
        </a>
      </div>
    </div>
  );
}
