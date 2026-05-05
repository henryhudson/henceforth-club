"use client";

import { useRef, type ReactNode } from "react";

type Accent = "warm" | "cyan" | "green";

const ACCENT: Record<Accent, { hoverBorder: string; label: string }> = {
  warm: { hoverBorder: "hover:border-accent-warm", label: "text-accent-warm" },
  cyan: { hoverBorder: "hover:border-accent", label: "text-accent" },
  green: { hoverBorder: "hover:border-accent-green", label: "text-accent-green" },
};

export default function TechModal({
  buttonLabel = "How it's built",
  accent,
  children,
}: {
  buttonLabel?: string;
  accent: Accent;
  children: ReactNode;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const config = ACCENT[accent];

  function open() {
    dialogRef.current?.showModal();
  }
  function close() {
    dialogRef.current?.close();
  }
  function onBackdropClick(e: React.MouseEvent<HTMLDialogElement>) {
    if (e.target === dialogRef.current) close();
  }

  return (
    <>
      <button
        type="button"
        onClick={open}
        className={`inline-flex items-center gap-2 rounded-full border border-card-border bg-card-bg/50 px-6 py-3 text-sm text-muted ${config.hoverBorder} hover:text-foreground transition-all`}
      >
        <svg
          className="h-4 w-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M16 18l6-6-6-6M8 6l-6 6 6 6"
          />
        </svg>
        {buttonLabel}
      </button>
      <dialog
        ref={dialogRef}
        onClick={onBackdropClick}
        className="backdrop:bg-background/80 backdrop:backdrop-blur-sm bg-transparent p-0 max-w-2xl w-[calc(100vw-2rem)] m-auto"
      >
        <div className="rounded-2xl border border-card-border bg-card-bg p-8 sm:p-10 max-h-[85vh] overflow-y-auto">
          <div className="flex items-start justify-between gap-4 mb-8">
            <p className={`text-xs tracking-widest uppercase ${config.label}/80`}>
              Engineering
            </p>
            <button
              type="button"
              onClick={close}
              className="-m-2 p-2 text-muted/60 hover:text-foreground transition-colors"
              aria-label="Close"
            >
              <svg
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
          <div className="text-sm leading-relaxed text-muted space-y-4 [&_h3]:text-foreground [&_h3]:font-bold [&_h3]:text-base [&_h3]:mt-6 [&_h3]:mb-2 [&_h3:first-child]:mt-0 [&_code]:text-accent-warm [&_code]:bg-card-bg [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-xs [&_a]:text-foreground [&_a]:underline [&_a]:underline-offset-4 [&_a:hover]:text-accent [&_strong]:text-foreground [&_strong]:font-medium">
            {children}
          </div>
        </div>
      </dialog>
    </>
  );
}
