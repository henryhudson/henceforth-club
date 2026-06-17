import type { ReactNode } from "react";
import Image from "next/image";
import { Nunito } from "next/font/google";
import { CONTACT } from "./content";

const nunito = Nunito({
  subsets: ["latin"],
  variable: "--font-nunito",
  display: "swap",
  weight: ["400", "600", "700", "800"],
});

const NAV = [
  { href: "#about", label: "About" },
  { href: "#values", label: "Values & Expertise" },
  { href: "#products", label: "Products" },
  { href: "#accreditations", label: "Accreditations" },
  { href: "#suppliers", label: "Suppliers" },
  { href: "#contact", label: "Contact" },
];

export default function ProvenanceLayout({ children }: { children: ReactNode }) {
  return (
    <div
      className={`provenance font-sans min-h-screen bg-background text-foreground ${nunito.variable}`}
    >
      <header className="sticky top-0 z-50 border-b border-card-border bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-6 px-6 py-3">
          <a href="#top" aria-label="Provenance Partners — top" className="shrink-0">
            <Image
              src="/provenance/logo.png"
              alt="Provenance Partners"
              width={200}
              height={41}
              priority
              className="h-9 w-auto"
            />
          </a>
          <nav className="hidden items-center gap-7 text-sm font-semibold lg:flex">
            {NAV.map((n) => (
              <a
                key={n.href}
                href={n.href}
                className="text-foreground/80 transition hover:text-[#330a49]"
              >
                {n.label}
              </a>
            ))}
          </nav>
          <a
            href="#contact"
            className="rounded-full bg-[#7cce2a] px-4 py-2 text-sm font-bold text-[#330a49] transition hover:brightness-95"
          >
            Contact us
          </a>
        </div>
      </header>

      <main id="top">{children}</main>

      <footer className="bg-[#330a49] text-white">
        <div className="mx-auto max-w-6xl px-6 py-12 text-sm">
          <Image
            src="/provenance/logo.png"
            alt="Provenance Partners"
            width={200}
            height={41}
            className="h-9 w-auto opacity-90"
          />
          <p className="mt-5 max-w-md text-white/70">{CONTACT.address}</p>
          <p className="mt-1 text-white/70">
            <a href={`mailto:${CONTACT.email}`} className="underline-offset-2 hover:underline">
              {CONTACT.email}
            </a>
          </p>
          <p className="mt-6 text-xs text-white/45">
            © {new Date().getFullYear()} Provenance Partners Limited. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
