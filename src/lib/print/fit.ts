export const START_PT = 7;
export const FLOOR_PT = 6;
export const CEIL_PT = 10;
export const STEP_PT = 0.2;

function roundPt(pt: number): number {
  return Math.round(pt * 10) / 10;
}

/**
 * Scale type so copy fills the remaining slot on the sheet. Grows a light
 * page, shrinks a heavy one, and never leaves the 6–10pt band.
 */
export function fitTypeSize(
  measure: (pt: number) => number,
  slotHeight: number | (() => number),
  start = START_PT,
  floor = FLOOR_PT,
  ceil = CEIL_PT,
): number {
  const slot = () => (typeof slotHeight === "function" ? slotHeight() : slotHeight);
  const slack = 2;
  let pt = start;
  let height = measure(pt);
  if (height > slot() + slack) {
    for (let g = 0; height > slot() + slack && pt > floor && g < 60; g++) {
      pt = roundPt(pt - STEP_PT);
      height = measure(pt);
    }
    return pt;
  }
  for (let g = 0; height < slot() - slack && pt < ceil && g < 60; g++) {
    pt = roundPt(pt + STEP_PT);
    height = measure(pt);
  }
  if (height > slot() && pt > floor) {
    pt = roundPt(pt - STEP_PT);
    measure(pt);
  }
  return pt;
}
