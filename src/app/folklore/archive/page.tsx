import type { Metadata } from "next";
import Link from "next/link";
import ArchiveFlow from "./ArchiveFlow";

/**
 * Metadata rides the same gate as the page body: while the flag is off, the
 * description honestly says the flow is still arriving; once it is on, a
 * link preview describes the live page rather than a stub that no longer
 * exists. Evaluated at build time, exactly like the page itself.
 */
export function generateMetadata(): Metadata {
  return process.env.XFOLKLORE_WEB_ARCHIVE_ENABLED === "true"
    ? {
        title: "Archive yours",
        description:
          "Drop the export X sent you, pay once, and your archive lands on Bitcoin — permanent, readable from any block explorer.",
      }
    : {
        title: "Archive yours",
        description: "Archive your X profile to Bitcoin from the browser — arriving shortly.",
      };
}

// A stub, nothing more — no form, no upload. It exists only so the "archive
// yours" call to action on /folklore never points at a dead link before the web
// archive flow itself is built.
function ArchiveStub() {
  return (
    <div className="min-h-screen bg-background pt-28">
      <div className="mx-auto max-w-2xl px-6 text-center">
        <h1 className="text-2xl font-bold text-foreground">Archive yours</h1>
        <p className="mt-3 text-muted">
          The web archive flow arrives shortly — meanwhile the Henceforth app archives cheaper,
          non-custodially.
        </p>
        <div className="mt-6 flex flex-col items-center gap-3 text-sm">
          <a
            className="text-accent hover:underline"
            href="https://apps.apple.com/app/henceforth/id1602896145"
          >
            Henceforth on the App Store
          </a>
          <Link href="/folklore" className="text-accent hover:underline">
            &larr; Back to the archive
          </Link>
        </div>
      </div>
    </div>
  );
}

/**
 * The mechanical gate. Everything the paid archive flow can do — upload,
 * quote, checkboxes, the payment code that can receive real money — stays
 * entirely unreachable until XFOLKLORE_WEB_ARCHIVE_ENABLED is exactly "true". The flag
 * stays unset in production until the five-point go-live gate
 * (scripts/xtext-worker/README.md) passes and Henry signs off; until then
 * this route renders only the stub above, exactly as it always has.
 */
export default async function ArchivePage() {
  if (process.env.XFOLKLORE_WEB_ARCHIVE_ENABLED !== "true") {
    return <ArchiveStub />;
  }

  // Read at render like the archive flag above; every kudos-shaped element
  // on this page stays invisible until the kudos economy is actually on.
  const kudosEnabled = process.env.KUDOS_ENABLED === "true";

  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto max-w-2xl px-6 py-10 text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted">Archive yours</p>
        <h1 className="mt-3 text-3xl font-bold text-foreground">&pound;2 + the inscription fee</h1>
        <p className="mt-2 text-sm text-muted">
          Drop the export X sent you. Two pounds plus the miner&rsquo;s fee, paid once, and the
          archive lands on the chain forever.
          {kudosEnabled &&
            " The £2 comes straight back to you as your kudos float — 2,000 kudos to give to the writing you rate."}
        </p>
      </header>

      <ArchiveFlow />

      <p className="mx-auto max-w-2xl px-6 pb-10 text-center text-sm text-muted">
        <Link href="/folklore" className="text-accent hover:underline">
          &larr; Back to the archive
        </Link>
      </p>
    </div>
  );
}
