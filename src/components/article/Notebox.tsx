import type { ReactNode } from "react";

type NoteboxProps = {
  children: ReactNode;
};

export function Notebox({ children }: NoteboxProps) {
  return (
    <aside className="my-6 border-l-[3px] border-accent-orange bg-card-bg/40 px-5 py-3 text-[15px] leading-[1.7] text-foreground/85 sm:text-base [&>p]:my-2 [&>p:first-child]:mt-0 [&>p:last-child]:mb-0">
      {children}
    </aside>
  );
}
