import { addDays, daysBetween } from "@/lib/calendar/hijri";
import { DAYS_PER_MONTH } from "./estimate";
import { predictedDays, type CyclePrediction } from "./cycle";

// «القضاء» Phase 2: a calm line before Ramadan while fasting qada remains
// («بقي على رمضان 40 يومًا، وعليكِ 6 أيام من قضاء الصيام»). Pure.
//
// It shows once the days she can still fast before Ramadan — from today to
// two days before it (the last day of شعبان is left out like every other
// day she can't fast: the Eids, أيام التشريق), less her expected excuse days
// in that window — are no more than what she owes + a margin of 7 days
// (Mona, 2026-11-16). Her expected excuse days: the predicted windows when
// her records allow (cycle.ts), else her average spread evenly.

export const REMINDER_MARGIN_DAYS = 7;

export type ReminderInput = {
  today: string;
  // the next Ramadan's first day
  ramadan: string;
  // fasting qada still owed
  remaining: number;
  // days she can't fast (fasting-days.ts), at least up to Ramadan
  blocked: Set<string>;
  prediction: CyclePrediction | null;
  // her average per month when there's no prediction (null: a man, or none)
  avg: number | null;
};

export type Reminder = { daysLeft: number; remaining: number; fastable: number };

export function ramadanReminder(i: ReminderInput): Reminder | null {
  const daysLeft = daysBetween(i.today, i.ramadan);
  if (i.remaining <= 0 || daysLeft <= 0) return null;
  const last = addDays(i.ramadan, -1);
  let open = 0;
  for (let d = i.today; daysBetween(d, last) >= 0; d = addDays(d, 1)) if (!i.blocked.has(d)) open++;
  let excuse = 0;
  if (i.prediction) {
    for (const d of predictedDays(i.prediction, i.today, last)) if (!i.blocked.has(d)) excuse++;
  } else if (i.avg) {
    excuse = Math.round((i.avg / DAYS_PER_MONTH) * open);
  }
  const fastable = Math.max(0, open - excuse);
  return fastable <= i.remaining + REMINDER_MARGIN_DAYS ? { daysLeft, remaining: i.remaining, fastable } : null;
}
