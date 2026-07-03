"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { advanceIndex } from "./readerIndex";

/**
 * Terminal-style keyboard navigation for the reading room: `j`/`k` step
 * between the archived posts on the page — scroll-loaded ones included,
 * since it queries the live document rather than any fixed list — and `o`
 * opens the focused post's own permalink. Mounted once on the profile page.
 * `handle` is only known on the paginated `/x/<handle>` route; without it
 * `o` has nowhere to link to, so it's simply ignored.
 */
export default function ReaderKeys({ handle }: { handle?: string }) {
  const router = useRouter();
  // Null means "nothing focused yet" — distinct from 0, so the very first
  // `j` or `k` press lands on the first post rather than skipping it.
  const indexRef = useRef<number | null>(null);

  useEffect(() => {
    function cards(): HTMLElement[] {
      return Array.from(document.querySelectorAll<HTMLElement>("[data-post-id]"));
    }

    function focusCard(nextIndex: number) {
      const list = cards();
      if (list.length === 0) return;
      const clamped = Math.min(Math.max(nextIndex, 0), list.length - 1);
      indexRef.current = clamped;
      list.forEach((card, i) => {
        card.classList.toggle("ring-2", i === clamped);
        card.classList.toggle("ring-accent", i === clamped);
      });
      const target = list[clamped];
      target.scrollIntoView({ block: "center" });
      // Move real keyboard focus too, not just the visual ring, so
      // assistive technology tracks the reading position.
      target.focus({ preventScroll: true });
    }

    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      const typing = target?.tagName === "INPUT" || target?.tagName === "TEXTAREA";
      if (typing || e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return;

      if (e.key === "j") {
        e.preventDefault();
        focusCard(advanceIndex(indexRef.current, 1, cards().length));
      } else if (e.key === "k") {
        e.preventDefault();
        focusCard(advanceIndex(indexRef.current, -1, cards().length));
      } else if (e.key === "o" && handle && indexRef.current !== null) {
        const postId = cards()[indexRef.current]?.dataset.postId;
        if (postId) router.push(`/x/${handle}/${postId}`);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handle, router]);

  return null;
}
