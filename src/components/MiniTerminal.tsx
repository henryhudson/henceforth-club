"use client";

import { useState, useRef, useEffect, useCallback } from "react";

const STACK_OPS: Record<string, (stack: number[]) => { stack: number[]; output?: string }> = {
  "+": (s) => {
    if (s.length < 2) return { stack: s, output: "Stack underflow" };
    const b = s.pop()!, a = s.pop()!;
    s.push(a + b);
    return { stack: s };
  },
  "-": (s) => {
    if (s.length < 2) return { stack: s, output: "Stack underflow" };
    const b = s.pop()!, a = s.pop()!;
    s.push(a - b);
    return { stack: s };
  },
  "*": (s) => {
    if (s.length < 2) return { stack: s, output: "Stack underflow" };
    const b = s.pop()!, a = s.pop()!;
    s.push(a * b);
    return { stack: s };
  },
  "/": (s) => {
    if (s.length < 2) return { stack: s, output: "Stack underflow" };
    const b = s.pop()!, a = s.pop()!;
    if (b === 0) return { stack: [...s, a, b], output: "Division by zero" };
    s.push(Math.trunc(a / b));
    return { stack: s };
  },
  mod: (s) => {
    if (s.length < 2) return { stack: s, output: "Stack underflow" };
    const b = s.pop()!, a = s.pop()!;
    s.push(a % b);
    return { stack: s };
  },
  dup: (s) => {
    if (s.length < 1) return { stack: s, output: "Stack underflow" };
    s.push(s[s.length - 1]);
    return { stack: s };
  },
  drop: (s) => {
    if (s.length < 1) return { stack: s, output: "Stack underflow" };
    s.pop();
    return { stack: s };
  },
  swap: (s) => {
    if (s.length < 2) return { stack: s, output: "Stack underflow" };
    const b = s.pop()!, a = s.pop()!;
    s.push(b, a);
    return { stack: s };
  },
  over: (s) => {
    if (s.length < 2) return { stack: s, output: "Stack underflow" };
    s.push(s[s.length - 2]);
    return { stack: s };
  },
  rot: (s) => {
    if (s.length < 3) return { stack: s, output: "Stack underflow" };
    const c = s.pop()!, b = s.pop()!, a = s.pop()!;
    s.push(b, c, a);
    return { stack: s };
  },
  ".": (s) => {
    if (s.length < 1) return { stack: s, output: "Stack underflow" };
    const val = s.pop()!;
    return { stack: s, output: String(val) };
  },
  ".s": (s) => {
    return { stack: s, output: `<${s.length}> ${s.join(" ")}` };
  },
  cr: (s) => ({ stack: s, output: "" }),
  clear: () => ({ stack: [], output: "Stack cleared" }),
};

export default function MiniTerminal() {
  const [open, setOpen] = useState(false);
  const [history, setHistory] = useState<{ input?: string; output: string }[]>([
    { output: "Mini FORTH — type HELP for commands" },
  ]);
  const [input, setInput] = useState("");
  const [stack, setStack] = useState<number[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Toggle with Ctrl+` or Cmd+`
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "`" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight);
  }, [history]);

  const processInput = useCallback(
    (raw: string) => {
      const tokens = raw.trim().toLowerCase().split(/\s+/);
      const outputs: string[] = [];
      const newStack = [...stack];

      for (const token of tokens) {
        if (token === "help") {
          outputs.push(
            "Numbers push to stack. Words: + - * / MOD DUP DROP SWAP OVER ROT . .S CR CLEAR"
          );
          outputs.push("Toggle: Ctrl+`  |  Close: type BYE");
          continue;
        }
        if (token === "bye") {
          setOpen(false);
          return;
        }

        const num = Number(token);
        if (!isNaN(num) && token !== "") {
          newStack.push(num);
          continue;
        }

        const op = STACK_OPS[token];
        if (op) {
          const result = op(newStack);
          newStack.length = 0;
          newStack.push(...result.stack);
          if (result.output !== undefined) outputs.push(result.output);
        } else {
          outputs.push(`${token} ?`);
        }
      }

      setStack(newStack);
      const outputText = outputs.length > 0 ? outputs.join(" ") + " " : "";
      setHistory((h) => [
        ...h,
        { input: raw, output: outputText + "ok." },
      ]);
    },
    [stack]
  );

  if (!open) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[9997] w-96 max-w-[calc(100vw-2rem)]">
      <div className="terminal-window shadow-2xl">
        <div className="flex items-center justify-between px-4 py-2 border-b border-card-border/50">
          <div className="flex items-center gap-2">
            <div className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
            <div className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
            <div className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
            <span className="ml-2 text-xs text-muted/50">mini-forth</span>
          </div>
          <button
            onClick={() => setOpen(false)}
            className="text-muted/50 hover:text-foreground text-xs transition-colors"
          >
            esc
          </button>
        </div>
        <div
          ref={scrollRef}
          className="p-4 text-xs leading-relaxed max-h-64 overflow-y-auto"
        >
          {history.map((entry, i) => (
            <div key={i}>
              {entry.input && (
                <p className="text-muted/60">
                  <span className="text-accent glow-cyan">$</span>{" "}
                  <span className="text-foreground">{entry.input}</span>
                </p>
              )}
              <p className="text-terminal-green">{entry.output}</p>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-2 px-4 py-3 border-t border-card-border/50">
          <span className="text-accent text-xs glow-cyan">$</span>
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && input.trim()) {
                processInput(input);
                setInput("");
              }
              if (e.key === "Escape") setOpen(false);
            }}
            className="flex-1 bg-transparent text-xs text-foreground outline-none placeholder:text-muted/30"
            placeholder="type forth here..."
            aria-label="FORTH terminal input"
            autoComplete="off"
            spellCheck={false}
          />
        </div>
        <div className="px-4 py-1.5 border-t border-card-border/30 text-[10px] text-muted/30">
          stack: [{stack.join(", ")}]
        </div>
      </div>
    </div>
  );
}
