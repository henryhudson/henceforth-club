import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Arena from "./Arena";

// /folklore/arena — flag-gated exactly like every kudos route: the flag is
// read per request (the page is forced dynamic), and while it is off the
// page is a quiet not-found rather than a teaser for something unreachable.

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "The arena",
  description: "Two texts, dealt. Kudos crowns one.",
  robots: { index: false },
};

export default function ArenaPage() {
  if (process.env.KUDOS_ENABLED !== "true") notFound();
  return (
    <main className="min-h-screen bg-background">
      <Arena />
    </main>
  );
}
