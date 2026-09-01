"use client";

import {
  Children,
  isValidElement,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { flushSync } from "react-dom";
import { packColumns, type PackResult, type Placement } from "@/lib/print/pack";
import s from "./pack.module.css";

export type SquareProps = {
  id: string;
  lead?: boolean;
  continues?: boolean;
  className?: string;
  children: ReactNode;
};

export function Square(props: SquareProps) {
  return <div className={props.className}>{props.children}</div>;
}
Square.displayName = "NewspaperSquare";

type SquareChild = {
  id: string;
  lead: boolean;
  continues: boolean;
  className?: string;
  node: ReactNode;
};

function readSquares(children: ReactNode): SquareChild[] {
  const squares: SquareChild[] = [];
  Children.forEach(children, (child) => {
    if (!isValidElement(child)) return;
    const props = child.props as Partial<SquareProps>;
    if (typeof props.id !== "string") return;
    squares.push({
      id: props.id,
      lead: !!props.lead,
      continues: !!props.continues,
      className: props.className,
      node: props.children,
    });
  });
  return squares;
}

function groupByColumn(placements: Placement[], columnCount: number): Placement[][] {
  const cols: Placement[][] = Array.from({ length: columnCount }, () => []);
  for (const p of placements) {
    cols[p.column]?.push(p);
  }
  for (const col of cols) col.sort((a, b) => a.y - b.y);
  return cols;
}

function readPack(root: HTMLElement, columnCount: number, slotPx: number): PackResult {
  const empty: PackResult = { placements: [], columnHeights: [0, 0, 0, 0], makespan: 0, splitIds: [] };
  const measure = root.querySelector("[data-pack-measure]");
  if (!(measure instanceof HTMLElement)) return empty;
  const items = [...measure.querySelectorAll("[data-pack-id]")].flatMap((node) => {
    if (!(node instanceof HTMLElement)) return [];
    const id = node.getAttribute("data-pack-id");
    if (!id) return [];
    return [
      {
        id,
        height: node.offsetHeight,
        lead: node.hasAttribute("data-pack-lead"),
        continues: node.hasAttribute("data-pack-continues"),
      },
    ];
  });
  if (slotPx <= 0) return empty;
  const gap = 2.2 * (96 / 25.4);
  return packColumns(items, slotPx, columnCount, gap);
}

function Fragment({
  className,
  height,
  clipTop,
  split,
  children,
}: {
  className?: string;
  height: number;
  clipTop: number;
  split: boolean;
  children: ReactNode;
}) {
  if (!split) return <div className={className}>{children}</div>;
  return (
    <div className={className} style={{ height, overflow: "hidden" }}>
      <div style={{ marginTop: -clipTop }}>{children}</div>
    </div>
  );
}

export default function PackLayout({
  children,
  columnCount = 4,
}: {
  children: ReactNode;
  columnCount?: number;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const packedKey = useRef("");
  const [placements, setPlacements] = useState<Placement[]>([]);
  const squares = readSquares(children);
  const byId = new Map(squares.map((sq) => [sq.id, sq]));
  const splitIds = new Set(
    placements.filter((p, _, all) => all.some((o) => o.id === p.id && o !== p)).map((p) => p.id),
  );
  const columns = groupByColumn(placements, columnCount);

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const run = () => {
      const result = readPack(root, columnCount, root.clientHeight);
      root.dataset.packMakespan = String(result.makespan);
      const key = JSON.stringify(result.placements);
      if (key === packedKey.current) return;
      packedKey.current = key;
      flushSync(() => setPlacements(result.placements));
    };
    run();
    root.addEventListener("newspaper-fit", run);
    return () => root.removeEventListener("newspaper-fit", run);
  }, [children, columnCount]);

  return (
    <div className={s.pack} data-pack-root ref={rootRef}>
      <div className={s.measure} data-pack-measure aria-hidden>
        {squares.map((sq) => (
          <div
            key={sq.id}
            data-pack-id={sq.id}
            {...(sq.lead ? { "data-pack-lead": "" } : {})}
            {...(sq.continues ? { "data-pack-continues": "" } : {})}
          >
            <div className={sq.className}>{sq.node}</div>
          </div>
        ))}
      </div>
      <div className={s.cols}>
        {columns.map((col, i) => (
          <div key={i} className={s.col}>
            {col.map((p) => {
              const sq = byId.get(p.id);
              if (!sq) return null;
              return (
                <div key={`${p.id}:${p.clipTop}`} className={s.item}>
                  <Fragment
                    className={sq.className}
                    height={p.height}
                    clipTop={p.clipTop}
                    split={splitIds.has(p.id)}
                  >
                    {sq.node}
                  </Fragment>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
