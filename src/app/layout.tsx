import type { Metadata } from "next";
import { Space_Mono } from "next/font/google";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import KonamiCode from "@/components/KonamiCode";
import MiniTerminal from "@/components/MiniTerminal";
import "./globals.css";

const spaceMono = Space_Mono({
  variable: "--font-space-mono",
  subsets: ["latin"],
  weight: ["400", "700"],
});

export const metadata: Metadata = {
  title: {
    default: "Henceforth Club",
    template: "%s | Henceforth Club",
  },
  description:
    "Henceforth (FORTH interpreter + Bitcoin wallet), DaDeckOfCards (multiplayer card game), and Hansard (UK Parliament browser) — iOS apps from Henceforth Club.",
  keywords: [
    "iOS",
    "apps",
    "FORTH",
    "Bitcoin",
    "BSV",
    "card game",
    "Henceforth",
    "DaDeckOfCards",
    "Hansard",
    "UK Parliament",
  ],
  metadataBase: new URL("https://henceforth.club"),
  openGraph: {
    title: "Henceforth Club",
    description:
      "A FORTH interpreter with a Bitcoin wallet, a multiplayer deck of cards, and a UK Parliament browser. iOS apps from Henceforth Club.",
    url: "https://henceforth.club",
    siteName: "Henceforth Club",
    locale: "en_NZ",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Henceforth Club",
    description:
      "A FORTH interpreter with a Bitcoin wallet, a multiplayer deck of cards, and a UK Parliament browser. iOS apps from Henceforth Club.",
  },
};

function Footer() {
  return (
    <footer className="border-t border-card-border/30">
      <div className="mx-auto max-w-6xl px-6 py-12">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-8">
          <div>
            <p className="text-sm font-bold text-accent glow-cyan">
              henceforth<span className="text-muted">.club</span>
            </p>
            <p className="mt-2 text-xs text-muted/60">
              iOS apps for thinkers and players
            </p>
          </div>
          <div className="flex gap-8 text-sm">
            <Link
              href="/henceforth"
              className="text-muted/60 transition-colors hover:text-foreground"
            >
              Henceforth
            </Link>
            <Link
              href="/dadeckofcards"
              className="text-muted/60 transition-colors hover:text-foreground"
            >
              DaDeckOfCards
            </Link>
            <Link
              href="/hansard"
              className="text-muted/60 transition-colors hover:text-foreground"
            >
              Hansard
            </Link>
            <Link
              href="/docs"
              className="text-muted/60 transition-colors hover:text-foreground"
            >
              Docs
            </Link>
            <Link
              href="/contact"
              className="text-muted/60 transition-colors hover:text-foreground"
            >
              Contact
            </Link>
          </div>
        </div>
        <div className="section-line mt-8" />
        <p className="mt-6 text-xs text-muted/40">
          &copy; {new Date().getFullYear()} Henceforth Bitcoin Limited. All rights reserved.
        </p>
        <p className="mt-3 text-[10px] text-muted/25">by Henry Hudson</p>
        <div className="mt-4 flex flex-col gap-1.5 text-[10px] text-muted/20">
          <p>Some say the old code still listens. Try the sequence the masters knew: up, up, down, down...</p>
          <p>Press the key beside 1 while holding control. A stack awaits.</p>
          <p>Not all paths are on the map. Say hello to the world and see what stacks up.</p>
        </div>
      </div>
    </footer>
  );
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${spaceMono.variable} h-full antialiased dark`}
    >
      <body className="min-h-full flex flex-col">
        <Navbar />
        <main className="flex-1">{children}</main>
        <Footer />
        <KonamiCode />
        <MiniTerminal />
      </body>
    </html>
  );
}
