// Pure, immutable patchers over a weekPlan array (retro.weekPlan). Both /whh and /hh patch the
// shared week planner through these; no I/O lives here.

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
