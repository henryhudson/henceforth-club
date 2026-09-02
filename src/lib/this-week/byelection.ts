/** When a by-election can be held, from the statute's own arithmetic.
 *
 *  A working day is defined by section 119 of the Representation of the People
 *  Act 1983: not a Saturday, a Sunday, Christmas Eve, Christmas Day, Good
 *  Friday, a bank holiday, or a day appointed for public thanksgiving or
 *  mourning. Christmas Day and Good Friday are bank holidays anyway; Christmas
 *  Eve is not, which is why it is named separately here.
 *
 *  The poll itself falls 21 to 27 working days after the writ is received. The
 *  window is that wide so that a Thursday always sits inside it, whenever the
 *  writ is moved, which is why by-elections are always on a Thursday.
 */

export const POLL_EARLIEST_WORKING_DAY = 21;
export const POLL_LATEST_WORKING_DAY = 27;

const DAY_MS = 86_400_000;

function toDate(iso: string): Date {
  const d = new Date(`${iso}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) throw new Error(`not a date: ${iso}`);
  return d;
}

const iso = (d: Date): string => d.toISOString().slice(0, 10);

/** Section 119, for a constituency in the part of the United Kingdom whose
 *  bank holidays are passed in. */
export function isWorkingDay(dayISO: string, bankHolidays: readonly string[]): boolean {
  const d = toDate(dayISO);
  const weekday = d.getUTCDay();
  if (weekday === 0 || weekday === 6) return false;
  if (bankHolidays.includes(dayISO)) return false;
  return !(d.getUTCMonth() === 11 && d.getUTCDate() === 24); // Christmas Eve
}

/** The day that is `n` working days after `startISO`, counting from the day
 *  after it. The start day itself is never counted, working or not. */
export function workingDaysAfter(startISO: string, n: number, bankHolidays: readonly string[]): string {
  if (!Number.isInteger(n) || n < 0) throw new Error(`not a count of days: ${n}`);
  let d = toDate(startISO);
  let counted = 0;
  while (counted < n) {
    d = new Date(d.getTime() + DAY_MS);
    if (isWorkingDay(iso(d), bankHolidays)) counted += 1;
  }
  return iso(d);
}

export interface PollWindow {
  /** The first day the poll may be held. */
  earliest: string;
  /** The last day it may be held. */
  latest: string;
  /** Every Thursday inside the window. In practice there is exactly one, and
   *  it is the day the poll is held. */
  thursdays: string[];
}

/** The window a returning officer may set the poll in, given the day the writ
 *  is received. */
export function pollWindow(writISO: string, bankHolidays: readonly string[]): PollWindow {
  const earliest = workingDaysAfter(writISO, POLL_EARLIEST_WORKING_DAY, bankHolidays);
  const latest = workingDaysAfter(writISO, POLL_LATEST_WORKING_DAY, bankHolidays);
  const thursdays: string[] = [];
  for (let d = toDate(earliest); iso(d) <= latest; d = new Date(d.getTime() + DAY_MS)) {
    if (d.getUTCDay() === 4) thursdays.push(iso(d));
  }
  return { earliest, latest, thursdays };
}

/** The one day the poll would fall on, or null when the window somehow holds
 *  no Thursday. Callers print the window itself rather than guess. */
export function pollDay(writISO: string, bankHolidays: readonly string[]): string | null {
  return pollWindow(writISO, bankHolidays).thursdays[0] ?? null;
}
