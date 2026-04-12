"use client";

import { useEffect, useState, useCallback } from "react";

const KONAMI = [
  "ArrowUp", "ArrowUp", "ArrowDown", "ArrowDown",
  "ArrowLeft", "ArrowRight", "ArrowLeft", "ArrowRight",
  "b", "a",
];

const FORTH_WORDS = [
  "DUP", "DROP", "SWAP", "OVER", "ROT", "NIP", "TUCK",
  "+", "-", "*", "/", "MOD", ".", "CR", "EMIT",
  "IF", "ELSE", "THEN", "DO", "LOOP", "BEGIN", "UNTIL",
  ":", ";", "VARIABLE", "CONSTANT", "CREATE", "DOES>",
  "FORTH", "WORDS", "SEE", "BYE", "ok.",
  "tx-new", "tx-broadcast", "wallet-balance",
  "SCRIPT-BEGIN", "SCRIPT-END", "SPV", "ARC",
  "HELLO", "WORLD", "STACK", "PUSH", "POP",
  "2DUP", "2DROP", "2SWAP", "2OVER", ">R", "R>",
];

interface FallingWord {
  id: number;
  word: string;
  x: number;
  delay: number;
  duration: number;
  color: string;
}

export default function KonamiCode() {
  const [, setSequence] = useState<string[]>([]);
  const [triggered, setTriggered] = useState(false);
  const [words, setWords] = useState<FallingWord[]>([]);

  const triggerRain = useCallback(() => {
    // Respect the user's OS-level motion preference — the Konami rain
    // is a pure-decoration easter egg, so users who've asked for less
    // motion shouldn't have 60 animated words flung at them.
    if (
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }

    setTriggered(true);
    const colors = [
      "rgb(94, 234, 212)",   // accent cyan
      "rgb(126, 231, 135)",  // terminal green
      "rgb(251, 191, 36)",   // accent warm
      "rgb(228, 228, 231)",  // foreground
    ];

    const newWords: FallingWord[] = Array.from({ length: 60 }, (_, i) => ({
      id: i,
      word: FORTH_WORDS[Math.floor(Math.random() * FORTH_WORDS.length)],
      x: Math.random() * 100,
      delay: Math.random() * 3,
      duration: 2 + Math.random() * 4,
      color: colors[Math.floor(Math.random() * colors.length)],
    }));
    setWords(newWords);

    setTimeout(() => {
      setTriggered(false);
      setWords([]);
    }, 8000);
  }, []);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      setSequence((prev) => {
        const next = [...prev, e.key].slice(-10);
        if (next.length === 10 && next.every((k, i) => k === KONAMI[i])) {
          triggerRain();
          return [];
        }
        return next;
      });
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [triggerRain]);

  if (!triggered) return null;

  return (
    <div
      className="fixed inset-0 z-[9998] pointer-events-none overflow-hidden"
      aria-hidden="true"
    >
      {words.map((w) => (
        <span
          key={w.id}
          className="absolute text-sm font-bold opacity-0"
          style={{
            left: `${w.x}%`,
            top: "-2rem",
            color: w.color,
            fontFamily: "var(--font-space-mono), monospace",
            animation: `konamiFall ${w.duration}s ${w.delay}s ease-in forwards`,
            textShadow: `0 0 8px ${w.color}`,
          }}
        >
          {w.word}
        </span>
      ))}
    </div>
  );
}
