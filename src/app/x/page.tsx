import type { Metadata } from "next";
import ArchiveExplorer from "./_components/ArchiveExplorer";

export const metadata: Metadata = {
  title: "My X profile, on Bitcoin",
  description: "An X (Twitter) profile reclaimed and rendered from its own data archive.",
};

export default function XPage() {
  return (
    <main className="min-h-screen bg-background pt-20">
      <header className="mx-auto max-w-2xl px-6 py-10 text-center">
        <p className="font-sans text-xs font-semibold uppercase tracking-[0.22em] text-muted">
          Reclaimed from X
        </p>
        <h1 className="mt-3 text-3xl font-bold text-foreground">Your profile, your data</h1>
        <p className="mt-2 text-sm text-muted">
          Rendered straight from your X archive. Replies show who you replied to.
        </p>
      </header>
      <ArchiveExplorer />
    </main>
  );
}
