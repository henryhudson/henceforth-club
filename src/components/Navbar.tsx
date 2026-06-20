"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";

export default function Navbar() {
  const [open, setOpen] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const pathname = usePathname();

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

  // The real session cookie is httpOnly (JS can't read it). Login also sets a
  // non-secret readable flag `board_signed_in=1` purely so this nav can choose
  // the green "Sign in" vs the red "Sign out" affordance. Re-checked on every
  // route change so a login/logout on /board reflects here without a reload.
  useEffect(() => {
    setSignedIn(
      document.cookie.split("; ").some((c) => c === "board_signed_in=1"),
    );
  }, [pathname]);

  if (pathname?.startsWith("/provenance")) return null;

  const links = [
    { href: "/henceforth", label: "Henceforth", hoverColor: "hover:text-accent-warm" },
    { href: "/dadeckofcards", label: "Deck of Cards", hoverColor: "hover:text-accent" },
    { href: "/hansard", label: "Hansard", hoverColor: "hover:text-accent-green" },
    { href: "/contact", label: "Contact", hoverColor: "hover:text-foreground" },
  ];

  // Liquid-glass pill, mirroring the henceforth CTA (rounded-full + translucent
  // tint + backdrop-blur + accent glow). Green = signed out (sign in); red =
  // signed in (sign out, which clears the httpOnly session server-side).
  const authButton = (extra = "") => (
    <Link
      href={signedIn ? "/board/logout" : "/board"}
      onClick={() => setOpen(false)}
      className={`inline-flex items-center justify-center gap-2 rounded-full border px-4 py-1.5 text-sm font-medium backdrop-blur-md transition-all ${
        signedIn
          ? "border-red-500/40 bg-red-500/10 text-red-400 shadow-lg shadow-red-500/10 hover:border-red-500/60 hover:bg-red-500/20 hover:shadow-red-500/20"
          : "border-accent-green/40 bg-accent-green/10 text-accent-green shadow-lg shadow-accent-green/10 hover:border-accent-green/60 hover:bg-accent-green/20 hover:shadow-accent-green/20"
      } ${extra}`}
    >
      {signedIn ? "Sign out" : "Sign in"}
    </Link>
  );

  return (
    <nav className="animate-slide-down sticky top-0 z-50 border-b border-card-border/50 bg-background/70 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link
          href="/"
          onClick={() => setOpen(false)}
          className="text-lg font-bold tracking-tight text-accent glow-cyan transition-all hover:opacity-80"
        >
          henceforth<span className="text-muted">.club</span>
        </Link>

        {/* Desktop links */}
        <div className="hidden sm:flex items-center gap-6 lg:gap-8 text-sm">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`transition-colors ${link.hoverColor} ${
                pathname === link.href ? "text-foreground" : "text-muted"
              }`}
            >
              {link.label}
            </Link>
          ))}
          {authButton()}
        </div>

        {/* Hamburger button */}
        <button
          onClick={() => setOpen(!open)}
          className="sm:hidden relative w-6 h-5 flex flex-col justify-between"
          aria-label={open ? "Close menu" : "Open menu"}
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
          open ? "max-h-80 opacity-100" : "max-h-0 opacity-0"
        }`}
      >
        <div className="border-t border-card-border/30 px-6 py-4 flex flex-col gap-4">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setOpen(false)}
              className={`text-sm transition-colors ${link.hoverColor} ${
                pathname === link.href ? "text-foreground" : "text-muted"
              }`}
            >
              {link.label}
            </Link>
          ))}
          {authButton("self-start")}
        </div>
      </div>
    </nav>
  );
}
