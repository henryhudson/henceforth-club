import type { Metadata } from "next";
import { Space_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import Navbar from "@/components/Navbar";
import SiteFooter from "@/components/SiteFooter";
import AppSubnav from "@/components/AppSubnav";
import KonamiCode from "@/components/KonamiCode";
import MiniTerminal from "@/components/MiniTerminal";
import PageViewTracker from "@/components/PageViewTracker";
import "./globals.css";

const spaceMono = Space_Mono({
  variable: "--font-space-mono",
  subsets: ["latin"],
  weight: ["400", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Henceforth Club",
    template: "%s | Henceforth Club",
  },
  description:
    "FORTH. Cards. Parliament. A FORTH interpreter with a Bitcoin wallet, a multiplayer deck of cards, and a UK Parliament browser. Native iOS apps. No ads.",
  keywords: [
    "iOS",
    "apps",
    "FORTH",
    "Bitcoin",
    "BSV",
    "card game",
    "Henceforth",
    "Deck of Cards",
    "Hansard",
    "UK Parliament",
  ],
  metadataBase: new URL("https://henceforth.club"),
  openGraph: {
    title: "Henceforth Club",
    description:
      "FORTH. Cards. Parliament. A FORTH interpreter with a Bitcoin wallet, a multiplayer deck of cards, and a UK Parliament browser. Native iOS. No ads.",
    url: "https://henceforth.club",
    siteName: "Henceforth Club",
    locale: "en_NZ",
    type: "website",
    images: [{ url: "/cover.png", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Henceforth Club",
    description:
      "FORTH. Cards. Parliament. A FORTH interpreter with a Bitcoin wallet, a multiplayer deck of cards, and a UK Parliament browser. Native iOS. No ads.",
    images: ["/cover.png"],
  },
};


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
        <AppSubnav />
        <main className="flex-1">{children}</main>
        <SiteFooter />
        <KonamiCode />
        <MiniTerminal />
        <PageViewTracker />
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
