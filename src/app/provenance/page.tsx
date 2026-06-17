import type { Metadata } from "next";
import type { ReactNode } from "react";
import Image from "next/image";
import FadeIn from "@/components/FadeIn";
import { robots, TITLE, DESCRIPTION } from "./seo";
import { HERO, ABOUT, VALUES, SUPPLIERS, PREPARED, PRODUCTS, CONTACT } from "./content";
import ValueCard from "./_components/ValueCard";
import ProductChip from "./_components/ProductChip";
import AccreditationRow from "./_components/AccreditationRow";

export const metadata: Metadata = { title: TITLE, description: DESCRIPTION, robots };

function Section({ id, children }: { id?: string; children: ReactNode }) {
  return (
    <section id={id} className="mx-auto max-w-6xl scroll-mt-20 px-6 py-20 sm:py-24">
      {children}
    </section>
  );
}

function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <span className="inline-block rounded-full bg-[#7cce2a]/15 px-3 py-1 text-xs font-bold uppercase tracking-wider text-[#330a49]">
      {children}
    </span>
  );
}

function Heading({ children }: { children: ReactNode }) {
  return <h2 className="text-3xl font-extrabold tracking-tight text-[#2a2e33] sm:text-4xl">{children}</h2>;
}

const btnPrimary =
  "inline-flex items-center justify-center rounded-full bg-[#7cce2a] px-6 py-3 font-bold text-[#330a49] transition hover:brightness-95";
const btnOutline =
  "inline-flex items-center justify-center rounded-full border-2 border-[#330a49] px-6 py-3 font-bold text-[#330a49] transition hover:bg-[#330a49] hover:text-white";

export default function ProvenancePage() {
  return (
    <>
      {/* HERO */}
      <section className="border-b border-card-border bg-gradient-to-b from-[#7cce2a]/[0.06] to-transparent">
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-6 py-16 sm:py-24 lg:grid-cols-2">
          <FadeIn>
            <Eyebrow>{HERO.eyebrow}</Eyebrow>
            <h1 className="mt-5 text-4xl font-extrabold leading-[1.1] tracking-tight text-[#2a2e33] sm:text-5xl">
              {HERO.headline}
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-muted">{HERO.sub}</p>
            <div className="mt-8 flex flex-wrap gap-4">
              <a href="#products" className={btnPrimary}>
                View our range
              </a>
              <a href="#contact" className={btnOutline}>
                Contact us
              </a>
            </div>
          </FadeIn>
          <FadeIn>
            <div className="relative aspect-[4/3] overflow-hidden rounded-3xl border border-card-border shadow-lg">
              <Image
                src="/provenance/about.jpg"
                alt="Fresh produce being grown and inspected"
                fill
                sizes="(min-width: 1024px) 36rem, 100vw"
                className="object-cover"
                priority
              />
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ABOUT */}
      <Section id="about">
        <FadeIn>
          <Eyebrow>About us</Eyebrow>
          <p className="mt-5 max-w-3xl text-xl leading-relaxed text-foreground">{ABOUT}</p>
          <div className="mt-8 flex flex-wrap gap-3 text-sm font-semibold">
            {["Est. 2011", "Year-round supply", "Retail", "Processing", "Food-service"].map((s) => (
              <span
                key={s}
                className="rounded-full border border-card-border px-4 py-2 text-[#330a49]"
              >
                {s}
              </span>
            ))}
          </div>
        </FadeIn>
      </Section>

      {/* VALUES */}
      <section className="bg-[#faf9fb]">
        <Section id="values">
          <FadeIn>
            <Eyebrow>Our values &amp; expertise</Eyebrow>
            <Heading>What sets us apart</Heading>
          </FadeIn>
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {VALUES.map((v) => (
              <FadeIn key={v.title}>
                <ValueCard icon={v.icon} title={v.title} body={v.body} />
              </FadeIn>
            ))}
          </div>
        </Section>
      </section>

      {/* PRODUCTS */}
      <Section id="products">
        <FadeIn>
          <Eyebrow>Our products</Eyebrow>
          <Heading>A premium, year-round range</Heading>
          <p className="mt-5 text-muted">
            <span className="font-bold text-[#330a49]">Prepared lines:</span> {PREPARED.join(" · ")}.
          </p>
        </FadeIn>
        <FadeIn>
          <div className="mt-8 flex flex-wrap gap-3">
            {PRODUCTS.map((p) => (
              <ProductChip key={p} label={p} />
            ))}
          </div>
        </FadeIn>
      </Section>

      {/* ACCREDITATIONS */}
      <section className="bg-[#faf9fb]">
        <Section id="accreditations">
          <FadeIn>
            <Eyebrow>Our accreditations</Eyebrow>
            <Heading>Sourced to exacting standards</Heading>
            <p className="mt-5 max-w-2xl text-muted">
              Ethical sourcing and food-safety compliance, independently certified.
            </p>
            <div className="mt-10">
              <AccreditationRow />
            </div>
          </FadeIn>
        </Section>
      </section>

      {/* SUPPLIERS */}
      <Section id="suppliers">
        <FadeIn>
          <Eyebrow>Our suppliers</Eyebrow>
          <Heading>A global network</Heading>
          <p className="mt-5 max-w-3xl text-xl leading-relaxed text-foreground">{SUPPLIERS}</p>
        </FadeIn>
      </Section>

      {/* CONTACT */}
      <section className="bg-[#faf9fb]">
        <Section id="contact">
          <FadeIn>
            <Eyebrow>Contact</Eyebrow>
            <Heading>Get in touch</Heading>
            <p className="mt-5 text-muted">{CONTACT.address}</p>
            <div className="mt-8 flex flex-wrap items-center gap-5">
              <a href={`mailto:${CONTACT.email}`} className={btnPrimary}>
                {CONTACT.email}
              </a>
              <a
                href={CONTACT.modernSlaveryPdf}
                className="font-semibold text-[#330a49] underline-offset-4 hover:underline"
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
