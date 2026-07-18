import type { Metadata } from "next";
import Link from "next/link";
import FadeIn from "@/components/FadeIn";

export const metadata: Metadata = {
  title: "About",
  description:
    "Henceforth Bitcoin Limited — native iOS apps built on one engineering stance: local truth, no ads, and tools that fit in your pocket.",
};

const apps = [
  {
    href: "/henceforth",
    title: "Henceforth",
    price: "$9.99",
    blurb:
      "Forth-2012 interpreter with a Bitcoin SV wallet. One terminal for stack programs, Script, and payments.",
    accent: "text-accent-warm",
  },
  {
    href: "/dadeckofcards",
    title: "Deck of Cards",
    price: "Free · multiplayer optional",
    blurb:
      "Multiplayer card games over Game Center. Spring physics, custom decks, no ads.",
    accent: "text-accent",
  },
  {
    href: "/hansard",
    title: "Hansard",
    price: "99p",
    blurb:
      "UK Parliament browser — Commons, Lords, constituency map, votes, and written questions. Offline from first launch.",
    accent: "text-accent-green",
  },
];

export default function AboutPage() {
  return (
    <div className="py-16 sm:py-24">
      <div className="mx-auto max-w-3xl px-6">
        <FadeIn>
          <p className="text-xs uppercase tracking-widest text-accent/70">
            Henceforth Bitcoin Limited
          </p>
          <h1 className="mt-6 text-5xl font-bold text-foreground sm:text-7xl">
            About
          </h1>
          <p className="mt-6 text-lg leading-relaxed text-muted">
            Native iOS apps by Henry Hudson. No ads, no tracking SDKs that do
            not earn their keep, and an engineering stance that treats the
            device as the source of truth.
          </p>
        </FadeIn>

        <FadeIn delay={0.1}>
          <div className="mt-12 space-y-4 text-[15px] leading-relaxed text-foreground/85 sm:text-base">
            <p>
              Three products share one spine:{" "}
              <strong className="text-foreground">local snapshot first</strong>,
              network only as newer evidence. That is how the Henceforth wallet
              refuses to shrink a verified balance because a chain service was
              briefly stale, and how Hansard renders every constituency with the
              radio off.
            </p>
            <p>
              The stack language is FORTH — small words, a LIFO pile, and the
              same shape as Bitcoin Script.{" "}
              <Link
                href="/henceforth/swiftbsv"
                className="text-accent-warm underline decoration-accent-warm/40 underline-offset-2"
              >
                SwiftBSV
              </Link>{" "}
              is the open-source Swift package under the wallet. Leo Brodie&rsquo;s{" "}
              <em>Starting FORTH</em> and <em>Thinking FORTH</em> still set the
              teaching tone for the{" "}
              <Link
                href="/learn"
                className="text-accent-warm underline decoration-accent-warm/40 underline-offset-2"
              >
                Learn
              </Link>{" "}
              series.
            </p>
          </div>
        </FadeIn>

        <div className="mt-16">
          <div className="section-line" />
          <FadeIn>
            <p className="mt-12 text-xs uppercase tracking-widest text-muted/50">
              Products
            </p>
          </FadeIn>
          <div className="mt-8 space-y-4">
            {apps.map((app, i) => (
              <FadeIn key={app.href} delay={0.1 + i * 0.08}>
                <Link
                  href={app.href}
                  className="group block rounded-xl border border-card-border bg-card-bg/50 p-6 transition-colors hover:border-card-border-hover"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h2 className={`text-xl font-bold ${app.accent}`}>
                      {app.title}
                    </h2>
                    <span className="text-xs text-muted/60">{app.price}</span>
                  </div>
                  <p className="mt-2 text-sm leading-relaxed text-muted">
                    {app.blurb}
                  </p>
                </Link>
              </FadeIn>
            ))}
          </div>
        </div>

        <FadeIn delay={0.4}>
          <div className="mt-16 rounded-xl border border-card-border bg-card-bg/40 p-6">
            <p className="text-xs uppercase tracking-widest text-muted/50">
              In development
            </p>
            <h2 className="mt-2 text-lg font-bold text-foreground">
              <Link
                href="/scriptedsupply"
                className="transition-colors hover:text-accent-warm"
              >
                Scripted Supply
              </Link>
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              Legible, replayable contracts for procurement on Bitcoin SV — a
              separate product surface, still cooking.
            </p>
          </div>
        </FadeIn>

        <FadeIn delay={0.45}>
          <p className="mt-12 text-sm text-muted">
            Questions?{" "}
            <Link
              href="/contact"
              className="text-accent-warm underline decoration-accent-warm/40 underline-offset-2"
            >
              Contact
            </Link>
            .
          </p>
        </FadeIn>
      </div>
    </div>
  );
}
