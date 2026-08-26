// Pure, immutable patchers over a weekPlan array. The live plan sits on the
// board (`board.week`); the weekly newspaper still archives a copy on the
// report. Both /whh and /hh patch through these; no I/O lives here.

import { currentWeekDates } from "./whh-aggregate.mjs";

/** The Sunday of the calendar week containing date (the planner's weekOf key). */
export function weekOfFor(date) {
  return currentWeekDates(date)[0];
}

const labelOf = (task) => (typeof task === "string" ? task : task.label);

/** A new weekPlan with the named weekday's events replaced wholesale. */
export function setDayEvents(plan, weekday, events) {
  return plan.map((day) => (day.weekday === weekday ? { ...day, tasks: events } : day));
}

/** A new weekPlan with the matching event on the named weekday marked done. */
export function markEventDone(plan, weekday, label) {
  return plan.map((day) =>
    day.weekday === weekday
      ? { ...day, tasks: day.tasks.map((t) => (labelOf(t) === label ? { label, done: true } : t)) }
      : day,
  );
}

const WEEKDAY_ORDER = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const isDone = (task) => typeof task !== "string" && task.done === true;

/** Live plan as it sits on the board: not a second document. */
export function weekSliceFromReport(week) {
  const weekPlan = week?.retro?.weekPlan ?? [];
  return {
    weekOf: weekPlan[0]?.date ?? week?.weekOf ?? "",
    generatedAt: week?.generatedAt,
    stateOfUnion: week?.retro?.stateOfUnion ?? "",
    weekPlan,
  };
}

/** A new board object with the live week attached. Cards unchanged. */
export function withWeek(board, slice) {
  return { ...board, week: slice };
}

/** Patch today's events / done-marks on the board's live week. Throws if no week. */
export function patchBoardWeek(board, { weekday, events = [], done = [], roll = false }) {
  const plan0 = board?.week?.weekPlan;
  if (!plan0) throw new Error("no week on the board");
  let plan = plan0;
  if (events.length) plan = setDayEvents(plan, weekday, events);
  else if (roll) plan = rollForward(plan, weekday);
  for (const label of done) plan = markEventDone(plan, weekday, label);
  return withWeek(board, { ...board.week, weekPlan: plan });
}

/** Tick one task on the board's live week by day-date and index. */
export function tickBoardWeek(board, { day, index, done }) {
  const plan0 = board?.week?.weekPlan;
  if (!plan0) throw new Error("no week on the board");
  const dayEntry = plan0.find((d) => d.date === day);
  const task = dayEntry?.tasks?.[index];
  if (task === undefined) throw new Error("no task");
  const base = typeof task === "string"
    ? { label: task }
    : { label: task.label, ...(task.start != null ? { start: task.start } : {}), ...(task.end != null ? { end: task.end } : {}) };
  const nextTask = done ? { ...base, done: true } : base;
  const weekPlan = plan0.map((d) => {
    if (d.date !== day) return d;
    const tasks = d.tasks.map((t, i) => (i === index ? nextTask : t));
    return { ...d, tasks };
  });
  return withWeek(board, { ...board.week, weekPlan });
}

/** A new weekPlan where every not-done task from a weekday earlier than today is moved onto today
 *  (carried, overdue-first), leaving each past day with only the tasks that were actually finished. */
export function rollForward(plan, todayWeekday) {
  const todayIdx = WEEKDAY_ORDER.indexOf(todayWeekday);
  const carried = [];
  const cleared = plan.map((day) => {
    const idx = WEEKDAY_ORDER.indexOf(day.weekday);
    if (idx >= 0 && idx < todayIdx) {
      carried.push(...day.tasks.filter((t) => !isDone(t)));
      return { ...day, tasks: day.tasks.filter(isDone) };
    }
    return day;
  });
  return cleared.map((day) => {
    if (day.weekday !== todayWeekday) return day;
    const here = new Set(day.tasks.map(labelOf));
    const fresh = carried.filter((t) => !here.has(labelOf(t)));
    return { ...day, tasks: [...fresh, ...day.tasks] };
  });
}
