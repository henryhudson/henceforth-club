"use client";

import Link from "next/link";
import FolkloreWordmark from "@/app/folklore/_components/FolkloreWordmark";
import { usePathname } from "next/navigation";
import { useState, useEffect, useSyncExternalStore } from "react";

// The real session cookie is httpOnly (JS can't read it). Login also sets a
// non-secret readable flag `board_signed_in=1` so this nav can choose the green
// "Sign in" vs the red "Sign out" affordance.
const noopSubscribe = () => () => {};
const readSignedIn = () =>
  document.cookie.split("; ").some((c) => c === "board_signed_in=1");

type NavLink = {
  href: string;
  label: string;
  hoverColor: string;
  match?: (pathname: string) => boolean;
};

export default function Navbar() {
  const [open, setOpen] = useState(false);
  const [appsOpen, setAppsOpen] = useState(false);
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

  if (pathname?.startsWith("/provenance")) return null;

  const apps: NavLink[] = [
    { href: "/henceforth", label: "Henceforth", hoverColor: "hover:text-accent-warm" },
    { href: "/dadeckofcards", label: "Deck of Cards", hoverColor: "hover:text-accent" },
    { href: "/hansard", label: "Hansard", hoverColor: "hover:text-accent-green" },
  ];

  const links: NavLink[] = [
    { href: "/learn", label: "Learn", hoverColor: "hover:text-accent-warm" },
    {
      href: "/docs",
      label: "Docs",
      hoverColor: "hover:text-accent-warm",
      match: (p) => p === "/docs" || p.startsWith("/docs/"),
    },
    {
      href: "/articles",
      label: "Articles",
      hoverColor: "hover:text-accent-warm",
      match: (p) => p === "/articles" || p.startsWith("/articles/"),
    },
    { href: "/folklore", label: "Folklore", hoverColor: "hover:text-accent-orange" },
    { href: "/contact", label: "Contact", hoverColor: "hover:text-foreground" },
  ];

  const appsActive = apps.some(
    (a) => pathname === a.href || pathname?.startsWith(a.href + "/"),
  );

  // Liquid-glass pill, mirroring the henceforth CTA (rounded-full + translucent
  // tint + backdrop-blur + accent glow). Green = signed out (sign in); red =
  // signed in (sign out, which clears the httpOnly session server-side).
  //
  // Sign out is a form POST, never a <Link>: the router prefetches Link hrefs,
  // and a prefetched cookie-clearing GET signs the user out on page render
  // instead of on click (the 2026-07-05 session-drop bug). The form uses
  // display:contents so the flex layouts see only the button.
  const pill = (extra: string) =>
    `inline-flex items-center justify-center gap-2 rounded-full border px-4 py-1.5 text-sm font-medium backdrop-blur-md transition-all ${
      signedIn
        ? "border-red-500/40 bg-red-500/10 text-red-400 shadow-lg shadow-red-500/10 hover:border-red-500/60 hover:bg-red-500/20 hover:shadow-red-500/20"
        : "border-accent-green/40 bg-accent-green/10 text-accent-green shadow-lg shadow-accent-green/10 hover:border-accent-green/60 hover:bg-accent-green/20 hover:shadow-accent-green/20"
    } ${extra}`;

  const authButton = (extra = "") =>
    signedIn ? (
      <form action="/board/logout" method="POST" className="contents">
        <button type="submit" onClick={() => setOpen(false)} className={pill(extra)}>
          Sign out
        </button>
      </form>
    ) : (
      <Link href="/board" onClick={() => setOpen(false)} className={pill(extra)}>
        Sign in
      </Link>
    );

  const linkClass = (link: NavLink) => {
    const active = link.match
      ? link.match(pathname ?? "")
      : pathname === link.href || pathname?.startsWith(link.href + "/");
    if (link.href === "/folklore") {
      return "text-accent-orange transition-opacity hover:opacity-75";
    }
    return `transition-colors ${link.hoverColor} ${
      active ? "text-foreground" : "text-muted"
    }`;
  };

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
        <div className="hidden sm:flex items-center gap-5 lg:gap-7 text-sm">
          <div
            className="relative"
            onMouseEnter={() => setAppsOpen(true)}
            onMouseLeave={() => setAppsOpen(false)}
          >
            <button
              type="button"
              className={`transition-colors hover:text-foreground ${
                appsActive ? "text-foreground" : "text-muted"
              }`}
              aria-expanded={appsOpen}
              aria-haspopup="true"
              onClick={() => setAppsOpen((v) => !v)}
            >
              Apps
            </button>
            {appsOpen && (
              <div className="absolute left-0 top-full z-50 pt-2">
                <div className="min-w-[11rem] rounded-xl border border-card-border bg-background/95 py-2 shadow-xl backdrop-blur-xl">
                  {apps.map((app) => (
                    <Link
                      key={app.href}
                      href={app.href}
                      className={`block px-4 py-2 text-sm transition-colors ${app.hoverColor} ${
                        pathname === app.href || pathname?.startsWith(app.href + "/")
                          ? "text-foreground"
                          : "text-muted"
                      }`}
                    >
                      {app.label}
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>

          {links.map((link) => (
            <Link key={link.href} href={link.href} className={linkClass(link)}>
              {link.href === "/folklore" ? (
                <FolkloreWordmark className="h-3.5 w-auto" />
              ) : (
                link.label
              )}
            </Link>
          ))}
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
          {apps.map((app) => (
            <Link
              key={app.href}
              href={app.href}
              onClick={() => setOpen(false)}
              className={`text-sm transition-colors ${app.hoverColor} ${
                pathname === app.href || pathname?.startsWith(app.href + "/")
                  ? "text-foreground"
                  : "text-muted"
              }`}
            >
              {app.label}
            </Link>
          ))}
          <div className="section-line my-1" />
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setOpen(false)}
              className={
                link.href === "/folklore"
                  ? "text-accent-orange transition-opacity hover:opacity-75"
                  : `text-sm ${linkClass(link)}`
              }
            >
              {link.href === "/folklore" ? (
                <FolkloreWordmark className="h-3.5 w-auto" />
              ) : (
                link.label
              )}
            </Link>
          ))}
          {authButton("self-start")}
        </div>
      </div>
    </nav>
  );
}
