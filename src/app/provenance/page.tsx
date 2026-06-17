import type { Metadata } from "next";
import type { ReactNode } from "react";
import FadeIn from "@/components/FadeIn";
import { robots, TITLE, DESCRIPTION } from "./seo";
import { VALUES, PREPARED, PRODUCTS, CONTACT } from "./content";
import ValueCard from "./_components/ValueCard";
import ProductChip from "./_components/ProductChip";
import AccreditationRow from "./_components/AccreditationRow";

export const metadata: Metadata = { title: TITLE, description: DESCRIPTION, robots };

function Section({ id, children }: { id?: string; children: ReactNode }) {
  return (
    <section id={id} className="mx-auto max-w-6xl px-6 py-24 sm:py-32">
      {children}
    </section>
  );
}

function Heading({ children }: { children: ReactNode }) {
  return <h2 className="font-serif text-3xl sm:text-4xl">{children}</h2>;
}

export default function ProvenancePage() {
  return (
    <>
      {/* HERO */}
      <section className="relative overflow-hidden">
        <div className="hero-gradient absolute inset-0" aria-hidden />
        <div className="relative mx-auto max-w-6xl px-6 py-32 sm:py-44">
          <FadeIn>
            <p className="text-xs uppercase tracking-[0.25em] text-muted">
              Fresh produce specialists · since 2011
            </p>
            <h1 className="mt-6 font-serif text-5xl font-semibold tracking-tight sm:text-7xl">
              Sourcing the world&rsquo;s finest <span className="text-accent">produce</span>.
            </h1>
            <p className="mt-6 max-w-2xl text-lg text-muted">
              A vertically integrated supplier of globally grown exotic vegetables to the
              UK&rsquo;s leading retailers, processors and food-service.
            </p>
            <div className="mt-10 flex flex-wrap items-center gap-5">
              <a
                href={`mailto:${CONTACT.email}`}
                className="rounded-full bg-accent px-7 py-3 font-semibold text-[#0a1f12] transition hover:bg-[#5ef0a0]"
              >
                Talk to us
              </a>
              <a href="#products" className="text-accent transition hover:text-[#5ef0a0]">
                View the range ↓
              </a>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ABOUT */}
      <Section>
        <FadeIn>
          <Heading>About</Heading>
          <p className="mt-6 max-w-3xl text-lg leading-relaxed text-muted">
            Founded in 2011 to bring Vegpro Kenya&rsquo;s produce to the UK, Provenance
            Partners has grown a global network of world-class supply partners —
            delivering best-in-class premium and prepared produce, year-round, to millions
            of UK consumers through the country&rsquo;s leading retailers, processors and
            food-service businesses.
          </p>
          <div className="mt-8 flex flex-wrap gap-3 text-sm">
            {["Est. 2011", "Year-round supply", "Retail · Processing · Food-service"].map(
              (s) => (
                <span key={s} className="rounded-full border border-card-border px-4 py-2">
                  {s}
                </span>
              ),
            )}
          </div>
        </FadeIn>
      </Section>

      {/* VALUES */}
      <Section>
        <FadeIn>
          <Heading>Values &amp; expertise</Heading>
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {VALUES.map((v) => (
              <ValueCard key={v.title} title={v.title} body={v.body} />
            ))}
          </div>
        </FadeIn>
      </Section>

      {/* PRODUCTS */}
      <Section id="products">
        <FadeIn>
          <Heading>Products</Heading>
          <p className="mt-6 text-muted">Prepared lines: {PREPARED.join(" · ")}.</p>
          <div className="mt-8 flex flex-wrap gap-3">
            {PRODUCTS.map((p) => (
              <ProductChip key={p} label={p} />
            ))}
          </div>
        </FadeIn>
      </Section>

      {/* ACCREDITATIONS */}
      <Section>
        <FadeIn>
          <Heading>Accreditations</Heading>
          <div className="mt-10">
            <AccreditationRow />
          </div>
        </FadeIn>
      </Section>

      {/* SUPPLIERS */}
      <Section>
        <FadeIn>
          <Heading>Suppliers</Heading>
          <p className="mt-6 max-w-3xl text-lg leading-relaxed text-muted">
            Our strength is our network. We work with and develop world-class supply
            partners across the globe, chosen for their ability to meet — and exceed —
            exacting product, technical and ethical standards, so our customers can rely on
            best-in-class produce whatever the season.
          </p>
        </FadeIn>
      </Section>

      {/* CONTACT */}
      <Section>
        <FadeIn>
          <Heading>Get in touch</Heading>
          <p className="mt-6 text-muted">{CONTACT.address}</p>
          <div className="mt-8 flex flex-wrap items-center gap-5">
            <a
              href={`mailto:${CONTACT.email}`}
              className="rounded-full bg-accent px-7 py-3 font-semibold text-[#0a1f12] transition hover:bg-[#5ef0a0]"
            >
              {CONTACT.email}
            </a>
            <a href={CONTACT.modernSlaveryPdf} className="text-accent transition hover:text-[#5ef0a0]">
              Modern Slavery statement (PDF)
            </a>
          </div>
        </FadeIn>
      </Section>
    </>
  );
}
