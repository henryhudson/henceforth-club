import type { Metadata } from "next";
import { Space_Mono } from "next/font/google";
import Link from "next/link";
import Navbar from "@/components/Navbar";
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
    "iOS apps by Henry Hudson — Henceforth (FORTH interpreter + Bitcoin wallet) and DaDeckOfCards (multiplayer card game).",
  keywords: [
    "iOS",
    "apps",
    "FORTH",
    "Bitcoin",
    "BSV",
    "card game",
    "Henceforth",
    "DaDeckOfCards",
  ],
  metadataBase: new URL("https://henceforth.club"),
  openGraph: {
    title: "Henceforth Club",
    description:
      "iOS apps by Henry Hudson — a FORTH interpreter with a Bitcoin wallet, and a multiplayer deck of cards.",
    url: "https://henceforth.club",
    siteName: "Henceforth Club",
    locale: "en_NZ",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Henceforth Club",
    description:
      "iOS apps by Henry Hudson — a FORTH interpreter with a Bitcoin wallet, and a multiplayer deck of cards.",
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
              iOS apps crafted by Henry Hudson
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
          &copy; {new Date().getFullYear()} Henry Hudson. All rights reserved.
        </p>
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
      </body>
    </html>
  );
}
