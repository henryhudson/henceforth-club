import type { ReactNode } from "react";
import Link from "next/link";
import { Fraunces, Inter } from "next/font/google";

const fraunces = Fraunces({ subsets: ["latin"], variable: "--font-fraunces", display: "swap" });
const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

export default function ProvenanceLayout({ children }: { children: ReactNode }) {
  return (
    <div
      className={`provenance font-sans min-h-screen bg-background text-foreground ${fraunces.variable} ${inter.variable}`}
    >
      {children}
      <footer className="mx-auto max-w-6xl px-6 py-16 text-sm text-muted">
        <p>Provenance Partners Limited · Clerkenwell, London</p>
        <Link href="/" className="text-accent transition hover:text-[#5ef0a0]">
          ↩ henceforth.club
        </Link>
      </footer>
    </div>
  );
}
