/**
 * What a profile shows while its archive is being read.
 *
 * A handle whose chunks are cached answers in milliseconds and this is never
 * seen; a handle being stitched for the first time can take seconds, and that
 * was the case with nothing on screen at all. The shell holds the page's real
 * proportions — name, ledger line, a column of posts — so the layout does not
 * jump when the archive lands.
 */
export default function Loading() {
  return (
    <main className="min-h-screen bg-background" role="status" aria-busy="true">
      <span className="sr-only">Reading this archive from Bitcoin</span>

      <div className="mx-auto max-w-2xl px-6 pt-20 motion-safe:animate-pulse" aria-hidden>
        <div className="h-7 w-44 rounded bg-card-border" />
        <div className="mt-3 h-3 w-64 rounded bg-card-border/60" />

        <div className="mt-10 space-y-4">
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} className="rounded-lg border border-card-border p-4">
              <div className="h-3 w-28 rounded bg-card-border/60" />
              <div className="mt-3 h-4 w-full rounded bg-card-border" />
              <div className="mt-2 h-4 w-5/6 rounded bg-card-border" />
              <div className="mt-2 h-4 w-2/3 rounded bg-card-border" />
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
