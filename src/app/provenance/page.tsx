import type { Metadata } from "next";
import type { ReactNode } from "react";
import Image from "next/image";
import FadeIn from "@/components/FadeIn";
import { robots, TITLE, DESCRIPTION } from "./seo";
import { HERO, ABOUT, VALUES, SUPPLIERS, PREPARED, PRODUCTS, CONTACT } from "./content";
import ValueIcon from "./_components/ValueIcon";
import AccreditationRow from "./_components/AccreditationRow";
import Globe from "./_components/Globe";

export const metadata: Metadata = { title: TITLE, description: DESCRIPTION, robots };

function Section({ id, children }: { id?: string; children: ReactNode }) {
  return (
    <section id={id} className="mx-auto max-w-6xl scroll-mt-24 px-6 py-24 sm:py-32">
      {children}
    </section>
  );
}

function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <p className="font-sans text-xs font-semibold uppercase tracking-[0.22em] text-muted">
      {children}
    </p>
  );
}

function Heading({ children }: { children: ReactNode }) {
  return (
    <h2 className="mt-4 font-serif text-4xl font-light leading-[1.1] tracking-tight text-[#2a2e33] sm:text-5xl">
      {children}
    </h2>
  );
}

const ctaGreen =
  "inline-flex items-center justify-center rounded-full bg-[#7cce2a] px-7 py-3 font-sans font-bold text-[#1c2e08] transition hover:brightness-95";

export default function ProvenancePage() {
  return (
    <>
      {/* HERO — full-bleed photograph + editorial headline */}
      <section className="relative h-[82vh] min-h-[540px] w-full overflow-hidden">
        <Image
          src="/provenance/editorial/hero.jpg"
          alt="Fresh produce growing in the field"
          fill
          priority
          sizes="100vw"
          className="object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-black/10" />
        <div className="absolute inset-x-0 bottom-0">
          <div className="mx-auto max-w-6xl px-6 pb-16 sm:pb-20">
            <FadeIn>
              <p className="font-sans text-xs font-semibold uppercase tracking-[0.25em] text-white/85">
                {HERO.eyebrow} · since 2011
              </p>
              <h1 className="mt-5 max-w-3xl font-serif text-5xl font-light leading-[1.04] text-white sm:text-7xl">
                {HERO.headline}
              </h1>
              <p className="mt-6 max-w-xl font-sans text-lg leading-relaxed text-white/85">
                {HERO.sub}
              </p>
              <div className="mt-9 flex flex-wrap gap-4">
                <a href="#products" className={ctaGreen}>
                  View the range
                </a>
                <a
                  href="#contact"
                  className="inline-flex items-center justify-center rounded-full border border-white/70 px-7 py-3 font-sans font-semibold text-white transition hover:bg-white hover:text-[#2a2e33]"
                >
                  Contact us
                </a>
              </div>
            </FadeIn>
          </div>
        </div>
      </section>

      {/* STORY */}
      <Section id="about">
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
          <FadeIn>
            <div className="relative aspect-[4/5] overflow-hidden rounded-sm">
              <Image
                src="/provenance/editorial/story.jpg"
                alt="Fresh produce held in the hand"
                fill
                sizes="(min-width:1024px) 32rem, 100vw"
                className="object-cover"
              />
            </div>
          </FadeIn>
          <FadeIn>
            <Eyebrow>Our story</Eyebrow>
            <Heading>Provenance, from the ground up</Heading>
            <p className="mt-6 font-sans text-lg leading-relaxed text-foreground/90">{ABOUT}</p>
            <dl className="mt-10 grid grid-cols-3 gap-6 border-t border-card-border pt-8">
              {[
                ["2011", "Founded"],
                ["Year-round", "Supply"],
                ["UK", "Retail · Processing · Food-service"],
              ].map(([big, small]) => (
                <div key={small}>
                  <dt className="font-serif text-3xl font-light text-[#2a2e33]">{big}</dt>
                  <dd className="mt-1 font-sans text-xs leading-snug text-muted">{small}</dd>
                </div>
              ))}
            </dl>
          </FadeIn>
        </div>
      </Section>

      {/* VALUES */}
      <section className="border-y border-card-border bg-[#fbfbf9]">
        <Section id="values">
          <FadeIn>
            <Eyebrow>Values &amp; expertise</Eyebrow>
            <Heading>What a partner should be</Heading>
          </FadeIn>
          <div className="mt-12 grid gap-x-10 gap-y-12 sm:grid-cols-2 lg:grid-cols-4">
            {VALUES.map((v) => (
              <FadeIn key={v.title}>
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#7cce2a]/15 text-[#3a6b12]">
                  <ValueIcon name={v.icon} />
                </div>
                <h3 className="mt-5 font-serif text-xl font-normal text-[#2a2e33]">{v.title}</h3>
                <p className="mt-2 font-sans text-sm leading-relaxed text-muted">{v.body}</p>
              </FadeIn>
            ))}
          </div>
        </Section>
      </section>

      {/* FEATURE image band */}
      <section className="relative h-[52vh] min-h-[360px] w-full overflow-hidden">
        <Image
          src="/provenance/editorial/feature.jpg"
          alt="Close detail of fresh green produce"
          fill
          sizes="100vw"
          className="object-cover"
        />
        <div className="absolute inset-0 bg-black/30" />
        <div className="absolute inset-0 flex items-center">
          <div className="mx-auto w-full max-w-6xl px-6">
            <p className="max-w-2xl font-serif text-2xl font-light italic leading-snug text-white sm:text-4xl">
              “Best-in-class premium and prepared produce, delivered year-round to millions of
              UK consumers.”
            </p>
          </div>
        </div>
      </section>

      {/* PRODUCTS */}
      <Section id="products">
        <div className="grid gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:gap-16">
          <FadeIn>
            <Eyebrow>Our products</Eyebrow>
            <Heading>A premium, year-round range</Heading>
            <p className="mt-6 font-sans text-base text-muted">
              Prepared lines: {PREPARED.join(" · ")}.
            </p>
            <ul className="mt-8 grid grid-cols-2 gap-x-8">
              {PRODUCTS.map((p) => (
                <li
                  key={p}
                  className="flex items-center gap-3 border-b border-card-border py-3 font-sans text-[15px] text-foreground/90"
                >
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#7cce2a]" aria-hidden />
                  {p}
                </li>
              ))}
            </ul>
          </FadeIn>
          <FadeIn>
            <div className="relative h-full min-h-[320px] overflow-hidden rounded-sm">
              <Image
                src="/provenance/editorial/produce.jpg"
                alt="Fresh green produce"
                fill
                sizes="(min-width:1024px) 28rem, 100vw"
                className="object-cover"
              />
            </div>
          </FadeIn>
        </div>
      </Section>

      {/* ACCREDITATIONS */}
      <section className="border-y border-card-border bg-[#fbfbf9]">
        <Section id="accreditations">
          <FadeIn>
            <Eyebrow>Accreditations</Eyebrow>
            <Heading>Sourced to exacting standards</Heading>
            <p className="mt-6 max-w-2xl font-sans text-muted">
              Ethical sourcing and food-safety compliance, independently certified.
            </p>
            <div className="mt-12">
              <AccreditationRow />
            </div>
          </FadeIn>
        </Section>
      </section>

      {/* SUPPLIERS */}
      <Section id="suppliers">
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
          <FadeIn>
            <Eyebrow>Our suppliers</Eyebrow>
            <Heading>A global network</Heading>
            <p className="mt-6 max-w-xl font-sans text-lg font-light leading-relaxed text-foreground/90">
              {SUPPLIERS}
            </p>
          </FadeIn>
          <FadeIn>
            <Globe />
          </FadeIn>
        </div>
      </Section>

      {/* CONTACT */}
      <section className="border-t border-card-border bg-[#fbfbf9]">
        <Section id="contact">
          <FadeIn>
            <Eyebrow>Contact</Eyebrow>
            <Heading>Let&rsquo;s talk produce</Heading>
            <p className="mt-6 font-sans text-muted">{CONTACT.address}</p>
            <div className="mt-9 flex flex-wrap items-center gap-6">
              <a href={`mailto:${CONTACT.email}`} className={ctaGreen}>
                {CONTACT.email}
              </a>
              <a
                href={CONTACT.modernSlaveryPdf}
                className="font-sans font-semibold text-[#330a49] underline-offset-4 hover:underline"
              >
                Modern Slavery statement (PDF)
              </a>
            </div>
          </FadeIn>
        </Section>
      </section>
    </>
  );
}
