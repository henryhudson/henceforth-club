"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";

export default function Navbar() {
  const [open, setOpen] = useState(false);
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

  const links = [
    { href: "/henceforth", label: "Henceforth", hoverColor: "hover:text-accent-warm" },
    { href: "/dadeckofcards", label: "Deck of Cards", hoverColor: "hover:text-accent" },
    { href: "/hansard", label: "Hansard", hoverColor: "hover:text-accent-green" },
    { href: "/contact", label: "Contact", hoverColor: "hover:text-foreground" },
  ];

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
        <div className="hidden sm:flex gap-8 text-sm">
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
          open ? "max-h-64 opacity-100" : "max-h-0 opacity-0"
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
        </div>
      </div>
    </nav>
  );
}
