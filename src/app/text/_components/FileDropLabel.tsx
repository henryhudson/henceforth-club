"use client";

import { useEffect, useState, type ReactNode } from "react";

/**
 * A drop target that actually accepts a drop. Both archive zones were a
 * label around a hidden file input with only onChange — the copy said
 * "Drop your files", but really dropping files hit the browser default and
 * navigated the page away to render them, destroying any in-progress state
 * (including a paid job's). This owns the drag wiring once: highlight on
 * drag-over, hand the files over on drop, and a window-level guard so a
 * stray drop OUTSIDE the zone is inert instead of a navigation.
 */
export default function FileDropLabel({
  onFiles,
  disabled = false,
  children,
}: {
  onFiles: (files: FileList | null) => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    const swallow = (e: DragEvent) => e.preventDefault();
    window.addEventListener("dragover", swallow);
    window.addEventListener("drop", swallow);
    return () => {
      window.removeEventListener("dragover", swallow);
      window.removeEventListener("drop", swallow);
    };
  }, []);

  return (
    <label
      className={`block cursor-pointer rounded-xl border border-dashed p-5 text-center text-sm text-muted transition ${
        dragging ? "border-accent bg-card-bg" : "border-card-border bg-card-bg/50 hover:border-accent"
      }`}
      onDragOver={(e) => {
        e.preventDefault();
        if (!disabled) setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        if (!disabled) onFiles(e.dataTransfer.files);
      }}
    >
      <input
        type="file"
        multiple
        accept=".js,.json"
        className="hidden"
        disabled={disabled}
        onChange={(e) => onFiles(e.target.files)}
      />
      {children}
    </label>
  );
}
