export const DEFAULT_COLUMNS = 4;

export type PackItem = {
  id: string;
  height: number;
  /** Place first, starting at column 0. The morning article / Hansard intro. */
  lead?: boolean;
  /** Allow leftover copy to continue in the next column. Default false. */
  continues?: boolean;
  /** The copy's line height, in the same unit as `height`. When set, a
   *  fragment ends on a whole line, so a split never shows half a line at the
   *  foot of one column and its other half at the head of the next. */
  lineHeight?: number;
  /** Offsets from the item's top, ascending, where a fragment may end: the
   *  bottoms of its rendered line boxes, measured. A heading or a margin puts
   *  the copy off the line-height grid, so when these are known they decide
   *  the cut and `lineHeight` is not consulted. */
  cuts?: number[];
};

export type Placement = {
  id: string;
  column: number;
  y: number;
  height: number;
  /** Offset into the item's full height where this fragment starts. */
  clipTop: number;
};

export type PackResult = {
  placements: Placement[];
  columnHeights: number[];
  makespan: number;
  splitIds: string[];
};

type Slot = {
  index: number;
  id: string;
  height: number;
  clipTop: number;
};

type Column = { used: number; slots: Slot[] };

function emptyColumns(n: number): Column[] {
  return Array.from({ length: n }, () => ({ used: 0, slots: [] }));
}

function remaining(col: Column, pageHeight: number): number {
  return pageHeight - col.used;
}

function roomFor(col: Column, height: number, pageHeight: number, gap: number): boolean {
  const extra = col.slots.length > 0 ? gap : 0;
  return col.used + extra + height <= pageHeight;
}

function pushSlot(col: Column, slot: Slot, gap: number): void {
  if (col.slots.length > 0) col.used += gap;
  col.slots.push(slot);
  col.used += slot.height;
}

function shortestFit(columns: Column[], height: number, pageHeight: number, gap: number): number {
  let best = -1;
  let bestUsed = Infinity;
  for (let i = 0; i < columns.length; i++) {
    if (roomFor(columns[i], height, pageHeight, gap) && columns[i].used < bestUsed) {
      best = i;
      bestUsed = columns[i].used;
    }
  }
  return best;
}

function shortestColumn(columns: Column[]): number {
  let best = 0;
  for (let i = 1; i < columns.length; i++) {
    if (columns[i].used < columns[best].used) best = i;
  }
  return best;
}

function mostRoom(columns: Column[], pageHeight: number): number {
  let best = 0;
  for (let i = 1; i < columns.length; i++) {
    if (remaining(columns[i], pageHeight) > remaining(columns[best], pageHeight)) best = i;
  }
  return best;
}

/** The largest cut that fits in `room`, measured from the fragment's own top
 *  (`clipTop` into the item); 0 when no whole line fits. */
function lastCutWithin(cuts: number[], clipTop: number, room: number): number {
  let best = 0;
  for (const cut of cuts) {
    const rel = cut - clipTop;
    if (rel <= 0) continue;
    if (rel > room) break;
    best = rel;
  }
  return best;
}

function placeSplit(
  columns: Column[],
  item: PackItem,
  index: number,
  pageHeight: number,
  startColumn: number,
  gap: number,
): void {
  let col = startColumn;
  let leftover = item.height;
  let clipTop = 0;
  const line = item.lineHeight && item.lineHeight > 0 ? item.lineHeight : 0;
  while (leftover > 0 && col < columns.length) {
    const extra = columns[col].slots.length > 0 ? gap : 0;
    const room = remaining(columns[col], pageHeight) - extra;
    if (room <= 0) {
      col += 1;
      continue;
    }
    let take = Math.min(leftover, room);
    if (take < leftover) {
      if (item.cuts && item.cuts.length > 0) {
        take = lastCutWithin(item.cuts, clipTop, room);
      } else if (line) {
        take = Math.floor(take / line) * line;
      }
      if (take <= 0) {
        col += 1;
        continue;
      }
    }
    pushSlot(columns[col], { index, id: item.id, height: take, clipTop }, gap);
    leftover -= take;
    clipTop += take;
    col += 1;
  }
  if (leftover > 0) {
    pushSlot(columns[columns.length - 1], { index, id: item.id, height: leftover, clipTop }, gap);
  }
}

function placeContinuing(
  columns: Column[],
  item: PackItem,
  index: number,
  pageHeight: number,
  gap: number,
): void {
  placeSplit(columns, item, index, pageHeight, mostRoom(columns, pageHeight), gap);
}

function placeLead(columns: Column[], item: PackItem, index: number, pageHeight: number, gap: number): void {
  const extra = columns[0].slots.length > 0 ? gap : 0;
  if (!item.continues || item.height <= remaining(columns[0], pageHeight) - extra) {
    pushSlot(columns[0], { index, id: item.id, height: item.height, clipTop: 0 }, gap);
    return;
  }
  placeSplit(columns, item, index, pageHeight, 0, gap);
}

function restack(columns: Column[], gap: number): PackResult {
  const placements: Placement[] = [];
  const columnHeights: number[] = [];
  const fragmentCount = new Map<string, number>();

  for (let c = 0; c < columns.length; c++) {
    const slots = [...columns[c].slots].sort((a, b) => a.index - b.index || a.clipTop - b.clipTop);
    let y = 0;
    for (const slot of slots) {
      placements.push({
        id: slot.id,
        column: c,
        y,
        height: slot.height,
        clipTop: slot.clipTop,
      });
      fragmentCount.set(slot.id, (fragmentCount.get(slot.id) ?? 0) + 1);
      y += slot.height + gap;
    }
    columnHeights.push(Math.max(0, y - (slots.length > 0 ? gap : 0)));
  }

  const splitIds = [...fragmentCount.entries()].filter(([, n]) => n > 1).map(([id]) => id);
  const makespan = columnHeights.reduce((m, h) => Math.max(m, h), 0);
  return { placements, columnHeights, makespan, splitIds };
}

export function packColumns(
  items: PackItem[],
  pageHeight: number,
  columnCount = DEFAULT_COLUMNS,
  gap = 0,
): PackResult {
  const columns = emptyColumns(columnCount);
  const usable = items
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => item.height > 0);

  if (usable.length === 0) {
    return { placements: [], columnHeights: columns.map(() => 0), makespan: 0, splitIds: [] };
  }

  const capacity = pageHeight > 0 ? pageHeight : Number.POSITIVE_INFINITY;

  for (const { item, index } of usable) {
    if (item.lead) placeLead(columns, item, index, capacity, gap);
  }

  const rest = usable
    .filter(({ item }) => !item.lead)
    .sort((a, b) => b.item.height - a.item.height || a.index - b.index);

  for (const { item, index } of rest) {
    const fit = shortestFit(columns, item.height, capacity, gap);
    if (fit >= 0) {
      pushSlot(columns[fit], { index, id: item.id, height: item.height, clipTop: 0 }, gap);
      continue;
    }
    if (item.continues) {
      placeContinuing(columns, item, index, capacity, gap);
      continue;
    }
    const col = shortestColumn(columns);
    pushSlot(columns[col], { index, id: item.id, height: item.height, clipTop: 0 }, gap);
  }

  return restack(columns, gap);
}
