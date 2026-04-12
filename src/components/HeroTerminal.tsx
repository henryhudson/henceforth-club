"use client";

import { useState, useRef, useCallback } from "react";
import FadeIn from "@/components/FadeIn";
import TimesTableCircle from "@/components/TimesTableCircle";

interface TerminalLine {
  type: "input" | "output";
  text: string;
}

const INITIAL_LINES: TerminalLine[] = [
  { type: "input", text: "2 3 + ." },
  { type: "output", text: "5 ok." },
  { type: "input", text: ': greet ." Hello, world!" ;' },
  { type: "output", text: "ok." },
  { type: "input", text: "greet" },
  { type: "output", text: "Hello, world! ok." },
];

export default function HeroTerminal() {
  const [lines, setLines] = useState<TerminalLine[]>(INITIAL_LINES);
  const [input, setInput] = useState("");
  const [userMultiplier, setUserMultiplier] = useState<number | undefined>();
  const inputRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      if (bodyRef.current) {
        bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
      }
    });
  }, []);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const trimmed = input.trim();
      if (!trimmed) return;

      const newLines: TerminalLine[] = [
        ...lines,
        { type: "input", text: trimmed },
      ];

      // Parse: if it's just a number, set the multiplier
      const num = parseFloat(trimmed);
      if (!isNaN(num) && num > 0) {
        setUserMultiplier(num);
        newLines.push({
          type: "output",
          text: `multiplier set to ${num} ok.`,
        });
        setLines(newLines);
        setInput("");
        scrollToBottom();
        return;
      }

      const cmd = trimmed.toLowerCase();

      if (cmd === "clear") {
        setLines(INITIAL_LINES);
        setUserMultiplier(undefined);
        setInput("");
        return;
      }

      if (cmd === "random") {
        setUserMultiplier(undefined);
        newLines.push({ type: "output", text: "random mode ok." });
        setLines(newLines);
        setInput("");
        scrollToBottom();
        return;
      }

      if (cmd === "analytics" || cmd === "stats") {
        newLines.push({ type: "output", text: "loading analytics..." });
        setLines(newLines);
        setInput("");
        scrollToBottom();

        try {
          const res = await fetch("/api/stats");
          const data = await res.json();

          setLines((prev) => {
            const withoutLoading = prev.slice(0, -1);
            if (!data.ok) {
              return [
                ...withoutLoading,
                {
                  type: "output",
                  text: "no data yet — come back after the next visitor. ok.",
                },
              ];
            }
            return [
              ...withoutLoading,
              ...formatStats(data),
              { type: "output", text: "ok." },
            ];
          });
          scrollToBottom();
        } catch {
          setLines((prev) => [
            ...prev.slice(0, -1),
            { type: "output", text: "error fetching stats. ok." },
          ]);
          scrollToBottom();
        }
        return;
      }

      if (cmd === "help") {
        newLines.push(
          { type: "output", text: "available commands:" },
          { type: "output", text: "  <number>    morph the circle pattern" },
          { type: "output", text: "  analytics   visitor stats" },
          { type: "output", text: "  random      resume random cycling" },
          { type: "output", text: "  clear       reset terminal" },
          { type: "output", text: "  help        this message" },
          { type: "output", text: "  2 3 + .     basic FORTH arithmetic" },
          { type: "output", text: "ok." }
        );
        setLines(newLines);
        setInput("");
        scrollToBottom();
        return;
      }

      // Simple stack evaluation for "X Y + ." style
      const result = tryForthEval(trimmed);
      if (result !== null) {
        newLines.push({ type: "output", text: `${result} ok.` });
      } else {
        newLines.push({ type: "output", text: "ok." });
      }

      setLines(newLines);
      setInput("");
      scrollToBottom();
    },
    [input, lines, scrollToBottom]
  );

  const focusInput = () => inputRef.current?.focus();

  return (
    <section className="relative hero-gradient overflow-hidden">
      <div className="absolute inset-0 hero-grid" />

      {/* Times-table circle */}
      <div className="absolute inset-0 flex items-center justify-end pointer-events-none overflow-hidden">
        <div className="w-[600px] h-[600px] sm:w-[800px] sm:h-[800px] -mr-[100px] sm:-mr-[50px] opacity-40">
          <TimesTableCircle userMultiplier={userMultiplier} />
        </div>
      </div>

      <div className="relative mx-auto max-w-6xl px-6 py-28 sm:py-40">
        <FadeIn>
          <div className="max-w-3xl">
            <p className="text-sm tracking-widest text-accent/70 uppercase">
              iOS Apps
            </p>
            <h1 className="mt-6 text-4xl sm:text-6xl leading-[1.1] text-foreground font-bold">
              FORTH. Cards. Parliament.
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted">
              A FORTH interpreter with a Bitcoin wallet. A multiplayer deck of
              cards. A UK Parliament browser. Native iOS. No ads.
            </p>
          </div>
        </FadeIn>

        <FadeIn delay={0.2}>
          <div className="mt-16 max-w-2xl">
            <div
              className="terminal-window relative terminal-scanlines cursor-text"
              onClick={focusInput}
            >
              {/* Title bar */}
              <div className="flex items-center gap-2 px-4 py-3 border-b border-card-border/50">
                <div className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
                <div className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
                <div className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
                <span className="ml-3 text-xs text-muted/50">henceforth</span>
              </div>
              {/* Terminal body */}
              <div
                ref={bodyRef}
                className="p-6 text-sm leading-[2] max-h-[280px] overflow-y-auto"
              >
                {lines.map((line, i) =>
                  line.type === "input" ? (
                    <p key={i} className="text-muted/60">
                      <span className="text-accent glow-cyan">$</span>{" "}
                      <span className="text-foreground">{line.text}</span>
                    </p>
                  ) : (
                    <p key={i} className="text-terminal-green">
                      {line.text}
                    </p>
                  )
                )}
                {/* Active input line */}
                <form onSubmit={handleSubmit} className="flex items-center">
                  <span className="text-accent glow-cyan">$</span>{" "}
                  <input
                    ref={inputRef}
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    className="flex-1 bg-transparent text-foreground outline-none border-none caret-accent ml-1"
                    autoComplete="off"
                    spellCheck={false}
                    placeholder="try a number..."
                    aria-label="FORTH terminal input"
                  />
                </form>
              </div>
            </div>
            <p className="mt-3 text-[10px] text-muted/30">
              Try a number (2, 3, 41, 51) or type <span className="text-muted/50">help</span>.
            </p>
          </div>
        </FadeIn>
      </div>
    </section>
  );
}

/** Tiny FORTH evaluator for simple "X Y op ." expressions */
function tryForthEval(input: string): number | null {
  const tokens = input.trim().split(/\s+/);
  const stack: number[] = [];

  for (const token of tokens) {
    const num = parseFloat(token);
    if (!isNaN(num)) {
      stack.push(num);
    } else if (token === "+" && stack.length >= 2) {
      stack.push(stack.pop()! + stack.pop()!);
    } else if (token === "-" && stack.length >= 2) {
      const b = stack.pop()!;
      const a = stack.pop()!;
      stack.push(a - b);
    } else if (token === "*" && stack.length >= 2) {
      stack.push(stack.pop()! * stack.pop()!);
    } else if (token === "/" && stack.length >= 2) {
      const b = stack.pop()!;
      const a = stack.pop()!;
      if (b === 0) return null;
      stack.push(Math.floor(a / b));
    } else if (token === "dup" && stack.length >= 1) {
      stack.push(stack[stack.length - 1]);
    } else if (token === "swap" && stack.length >= 2) {
      const b = stack.pop()!;
      const a = stack.pop()!;
      stack.push(b, a);
    } else if (token === "drop" && stack.length >= 1) {
      stack.pop();
    } else if (token === ".") {
      if (stack.length >= 1) return stack.pop()!;
      return null;
    } else if (token === ".s") {
      return null; // ignore for now
    }
  }

  // If there's a result on the stack but no ".", still show it
  if (stack.length === 1) return stack[0];
  return null;
}

interface StatsData {
  ok: true;
  total: number;
  today: number;
  week: number;
  month: number;
  year: number;
  sparkline: number[];
}

/** Format stats data into terminal lines with an ASCII sparkline */
function formatStats(data: StatsData): TerminalLine[] {
  const { total, today, week, month, year, sparkline } = data;

  const ordinal = (n: number) => {
    const s = ["th", "st", "nd", "rd"];
    const v = n % 100;
    return n.toLocaleString() + (s[(v - 20) % 10] || s[v] || s[0]);
  };

  // Build an ASCII sparkline from the 30-day series
  const max = Math.max(...sparkline, 1);
  const blocks = "▁▂▃▄▅▆▇█";
  const spark = sparkline
    .map((v) => {
      const idx = Math.min(
        blocks.length - 1,
        Math.floor((v / max) * (blocks.length - 1))
      );
      return blocks[idx];
    })
    .join("");

  const pad = (label: string) => label.padEnd(18, " ");

  return [
    { type: "output", text: "── visitor stats ─────────────────" },
    { type: "output", text: `you are the ${ordinal(total)} visitor.` },
    { type: "output", text: "" },
    { type: "output", text: `${pad("total")} ${total.toLocaleString()}` },
    { type: "output", text: `${pad("today")} ${today.toLocaleString()}` },
    { type: "output", text: `${pad("last 7 days")} ${week.toLocaleString()}` },
    { type: "output", text: `${pad("last 30 days")} ${month.toLocaleString()}` },
    { type: "output", text: `${pad("last year")} ${year.toLocaleString()}` },
    { type: "output", text: "" },
    { type: "output", text: `last 30 days: ${spark}` },
    { type: "output", text: "──────────────────────────────────" },
  ];
}
