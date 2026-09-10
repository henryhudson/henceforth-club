"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { usePrefersReducedMotion } from "@/lib/usePrefersReducedMotion";

export default function FadeIn({
  children,
  delay = 0,
  className = "",
  direction = "up",
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
  direction?: "up" | "down" | "left" | "right" | "none";
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [scrolledIn, setScrolledIn] = useState(false);
  const prefersReducedMotion = usePrefersReducedMotion();
  // Less motion means the section is simply there. Read at render rather than
  // latched into state by the effect, so a reader who asks for less motion
  // mid-page settles every section still below the fold, not only the ones a
  // remount happens to rebuild.
  const shown = scrolledIn || prefersReducedMotion;

  useEffect(() => {
    const el = ref.current;
    if (!el || prefersReducedMotion) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setScrolledIn(true);
          observer.disconnect();
        }
      },
      { rootMargin: "-60px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [prefersReducedMotion]);

  const dirClass =
    direction === "none" || shown === false
      ? ""
      : direction === "down"
        ? "animate-slide-down"
        : "animate-in";

  return (
    <div
      ref={ref}
      className={`${className} ${shown ? dirClass : "opacity-0"}`}
      style={shown ? { animationDelay: `${delay}s` } : undefined}
    >
      {children}
    </div>
  );
}
