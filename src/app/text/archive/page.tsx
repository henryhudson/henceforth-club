import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Archive yours",
  description: "Archive your X profile to Bitcoin from the browser — arriving shortly.",
};

// A stub, nothing more — no form, no upload. It exists only so the "archive
// yours" call to action on /text never points at a dead link before the web
// archive flow itself is built.
export default function ArchivePage() {
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
          <Link href="/text" className="text-accent hover:underline">
            &larr; Back to the archive
          </Link>
        </div>
      </div>
    </div>
  );
}
