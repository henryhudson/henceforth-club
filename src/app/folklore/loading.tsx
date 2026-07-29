import FolkloreWordmark from "./_components/FolkloreWordmark";

/**
 * What the board shows while its server reads are in flight.
 *
 * The page is one long `await` — the witness archive, the ledger rollup, the
 * board and its rows — and until this existed a cold render showed the browser
 * spinner and nothing else. Next serves this shell immediately and swaps in
 * the real page when the reads land, so the wordmark and the shape of the
 * thing arrive first.
 *
 * Deliberately not a fake board: skeleton bars stand in for rows whose count
 * nobody knows yet, and the line says what is actually happening rather than
 * counting down to a time we cannot predict.
 */
export default function Loading() {
  return (
    <div className="min-h-screen bg-background" role="status" aria-busy="true">
      <span className="sr-only">Reading the folklore board from Bitcoin</span>

      <header className="relative min-h-[min(52vh,28rem)] overflow-hidden">
        <div className="relative z-10 mx-auto flex min-h-[min(52vh,28rem)] max-w-2xl flex-col items-center justify-center px-6 pb-12 pt-20 text-center">
          <h1>
            <FolkloreWordmark
              aria-hidden
              className="mx-auto h-auto w-full max-w-[220px] text-accent sm:max-w-[280px]"
            />
          </h1>
          <p className="ledger-label mt-5">reading from bitcoin</p>
        </div>
      </header>

      <div className="mx-auto max-w-2xl px-6 pb-24">
        <div
          className="divide-y divide-card-border border-y border-card-border motion-safe:animate-pulse"
          aria-hidden
        >
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="flex items-center gap-4 px-4 py-4">
              <span className="font-mono text-sm text-card-border">⛓</span>
              <div className="min-w-0 flex-1">
                <div className="h-4 w-32 rounded bg-card-border" />
                <div className="mt-2 h-3 w-48 rounded bg-card-border/60" />
              </div>
              <div className="h-3 w-16 shrink-0 rounded bg-card-border/60" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
