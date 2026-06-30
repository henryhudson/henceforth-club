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
