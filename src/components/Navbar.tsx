"use client";

import Link from "next/link";
import FolkloreWordmark from "@/app/folklore/_components/FolkloreWordmark";
import { usePathname } from "next/navigation";
import { useState, useEffect, useSyncExternalStore } from "react";

// The real session cookie is httpOnly (JS can't read it). Login also sets a
// non-secret readable flag `board_signed_in=1` so this nav can choose the
// "Sign in" vs "Sign out" affordance.
const noopSubscribe = () => () => {};
const readSignedIn = () =>
  document.cookie.split("; ").some((c) => c === "board_signed_in=1");

type AppLink = {
  href: string;
  label: string;
  hoverColor: string;
  tick: string;
};

export default function Navbar() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  // Re-evaluated on each render (incl. route changes via usePathname), so a
  // login/logout reflects here — no setState-in-effect.
  const signedIn = useSyncExternalStore(noopSubscribe, readSignedIn, () => false);

  // Prevent body scroll when the mobile menu is open. Restore whatever
  // overflow value was in place before we touched it, so we don't stomp
  // on other components that may also be managing body scroll.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = open ? "hidden" : prev;
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Immersive surfaces — no club chrome. Provenance and Folklore own the frame.
  if (pathname?.startsWith("/provenance") || pathname?.startsWith("/folklore")) return null;

  // The shelf: every app, each with a tick in its own accent. Learn, Docs,
  // and Articles are Henceforth content — they live in its section nav
  // (content-nav.ts), not up here.
  const apps: AppLink[] = [
    { href: "/henceforth", label: "Henceforth", hoverColor: "hover:text-accent-warm", tick: "bg-accent-warm" },
    { href: "/dadeckofcards", label: "Deck of Cards", hoverColor: "hover:text-accent", tick: "bg-accent" },
    { href: "/hansard", label: "Hansard", hoverColor: "hover:text-accent-green", tick: "bg-accent-green" },
    { href: "/folklore", label: "Folklore", hoverColor: "hover:opacity-75", tick: "bg-accent-orange" },
  ];

  const isActive = (href: string) =>
    pathname === href || pathname?.startsWith(href + "/");

  // Sign out is a form POST, never a <Link>: the router prefetches Link hrefs,
  // and a prefetched cookie-clearing GET signs the user out on page render
  // instead of on click (the 2026-07-05 session-drop bug). The form uses
  // display:contents so the flex layouts see only the button.
  const authClass = (extra = "") =>
    `text-sm transition-colors ${
      signedIn
        ? "text-red-400/80 hover:text-red-300"
        : "text-muted/70 hover:text-foreground"
    } ${extra}`;

  const authButton = (extra = "") =>
    signedIn ? (
      <form action="/board/logout" method="POST" className="contents">
        <button type="submit" onClick={() => setOpen(false)} className={authClass(extra)}>
          Sign out
        </button>
      </form>
    ) : (
      <Link href="/board" onClick={() => setOpen(false)} className={authClass(extra)}>
        Sign in
      </Link>
    );

  const appLink = (app: AppLink) => (
    <Link
      key={app.href}
      href={app.href}
      onClick={() => setOpen(false)}
      className={`inline-flex items-center gap-2 text-sm transition-all ${app.hoverColor} ${
        app.href === "/folklore"
          ? "text-accent-orange"
          : isActive(app.href)
            ? "text-foreground"
            : "text-muted"
      }`}
    >
      <span aria-hidden className={`h-3.5 w-[3px] rounded-[1px] ${app.tick}`} />
      {app.href === "/folklore" ? (
        <FolkloreWordmark className="h-3.5 w-auto" />
      ) : (
        app.label
      )}
    </Link>
  );

  const contactLink = (extra = "") => (
    <Link
      href="/contact"
      onClick={() => setOpen(false)}
      className={`text-sm transition-colors hover:text-foreground ${
        isActive("/contact") ? "text-foreground" : "text-muted"
      } ${extra}`}
    >
      Contact
    </Link>
  );

  return (
    <nav className="animate-slide-down sticky top-0 z-50 border-b border-card-border/50 bg-background/70 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link
          href="/"
          onClick={() => setOpen(false)}
          className="text-lg font-bold tracking-tight text-accent-club glow-club transition-all hover:opacity-80"
        >
          henceforth<span className="text-muted">.club</span>
        </Link>

        {/* Desktop shelf */}
        <div className="hidden sm:flex items-center gap-5 lg:gap-6 text-sm">
          {apps.map((app) => appLink(app))}
          <span aria-hidden className="text-muted/40">
            ·
          </span>
          {contactLink()}
          {authButton()}
        </div>

        {/* Hamburger button */}
        <button
          onClick={() => setOpen(!open)}
          className="sm:hidden relative w-6 h-5 flex flex-col justify-between"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
        >
          <span
            className={`block h-px w-full bg-foreground transition-all duration-300 origin-center ${
              open ? "translate-y-[9px] rotate-45" : ""
            }`}
          />
          <span
            className={`block h-px w-full bg-foreground transition-all duration-300 ${
              open ? "opacity-0 scale-x-0" : ""
            }`}
          />
          <span
            className={`block h-px w-full bg-foreground transition-all duration-300 origin-center ${
              open ? "-translate-y-[9px] -rotate-45" : ""
            }`}
          />
        </button>
      </div>

      {/* Mobile menu */}
      <div
        className={`sm:hidden overflow-hidden transition-all duration-300 ease-out ${
          open ? "max-h-[32rem] opacity-100" : "max-h-0 opacity-0"
        }`}
      >
        <div className="border-t border-card-border/30 px-6 py-4 flex flex-col gap-4">
          <p className="text-[10px] uppercase tracking-widest text-muted/40">Apps</p>
          {apps.map((app) => appLink(app))}
          <div className="section-line my-1" />
          {contactLink()}
          {authButton("self-start")}
        </div>
      </div>
    </nav>
  );
}
