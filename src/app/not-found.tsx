import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex flex-1 items-center justify-center py-24">
      <div className="text-center px-6">
        <div className="terminal-window inline-block text-left mb-8">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-card-border/50">
            <div className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
            <div className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
            <div className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
          </div>
          <div className="p-6 text-sm leading-[2]">
            <p className="text-muted/60">
              <span className="text-accent-club glow-club">$</span>{" "}
              <span className="text-foreground">find page</span>
            </p>
            <p className="text-red-400">Error: page not found</p>
            <p className="text-muted/60">
              <span className="text-accent-club glow-club">$</span>{" "}
              <span className="cursor-blink text-foreground">_</span>
            </p>
          </div>
        </div>

        <h1 className="text-6xl font-bold text-foreground">404</h1>
        <p className="mt-4 text-muted">
          This page doesn&apos;t exist. Maybe it was moved, or you mistyped the URL.
        </p>
        <Link
          href="/"
          className="mt-8 inline-flex items-center gap-2 rounded-full border border-card-border bg-card-bg/50 px-6 py-3 text-sm text-muted hover:border-card-border-hover hover:text-foreground transition-all"
        >
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M11 17l-5-5m0 0l5-5m-5 5h12" />
          </svg>
          Back to home
        </Link>
      </div>
    </div>
  );
}
