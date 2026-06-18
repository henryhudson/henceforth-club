import type { ReactNode } from "react";
import Image from "next/image";
import { Source_Serif_4, DM_Sans } from "next/font/google";
import { CONTACT } from "./content";

const sourceSerif = Source_Serif_4({
  subsets: ["latin"],
  variable: "--font-source-serif",
  display: "swap",
});
const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm-sans",
  display: "swap",
  weight: ["400", "500", "700"],
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
      className={`provenance font-sans min-h-screen bg-background text-foreground ${sourceSerif.variable} ${dmSans.variable}`}
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
              className="h-12 w-auto sm:h-14"
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

      <footer className="border-t-4 border-[#7cce2a] bg-white">
        <div className="mx-auto max-w-6xl px-6 py-12 text-sm">
          <Image
            src="/provenance/logo.png"
            alt="Provenance Partners"
            width={200}
            height={41}
            className="h-14 w-auto"
          />
          <p className="mt-5 max-w-md text-muted">{CONTACT.address}</p>
          <p className="mt-1">
            <a
              href={`mailto:${CONTACT.email}`}
              className="text-[#330a49] underline-offset-2 hover:underline"
            >
              {CONTACT.email}
            </a>
          </p>
          <p className="mt-6 text-xs text-muted">
            © {new Date().getFullYear()} Provenance Partners Limited. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
