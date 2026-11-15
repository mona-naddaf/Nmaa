import { addDays, daysBetween, toHijri } from "@/lib/calendar/hijri";
import { occasionOccurrence, type Adjustment } from "@/lib/calendar/occasions";

// «القضاء» Phase 2: after Ramadan, the days of it her excuse took, offered
// once as fasting qada («أُضيف … إلى قضاء الصيام؟»). Pure.
//
// A Ramadan day counts when her excuse overlaps that day's fasting hours by
// at least a minute: Fajr to Maghrib at her place (an adult's own city, a
// child's family's). Without a place: any overlap with the day itself
// (Mona, 2026-11-16), with a line asking her to set her city. Ramadan's
// days follow her calendar's moon-sighting shifts.

export type Moment = { day: string; min: number };
export type ExcuseSpan = { start: Moment; end: Moment };
/** That day's fasting hours in minutes of the day (Fajr, Maghrib); null: no place. */
export type FastHours = (day: string) => { from: number; to: number } | null;

export type RamadanDays = { year: number; first: string; eid: string };

/** One Hijri year's Ramadan: its first day and the Eid (the day after the last). */
export function ramadanOf(year: number, adjustments: Adjustment[] = []): RamadanDays | null {
  const first = occasionOccurrence("RAMADAN_START", year, adjustments)?.date;
  const eid = occasionOccurrence("EID_FITR", year, adjustments)?.date;
  return first && eid ? { year, first, eid } : null;
}

/** The Ramadan to offer on `today`: the last one whose Eid has come, while the next hasn't begun. */
export function ramadanToOffer(today: string, adjustments: Adjustment[] = []): RamadanDays | null {
  const y = toHijri(today).year;
  for (const year of [y, y - 1]) {
    const r = ramadanOf(year, adjustments);
    if (!r || daysBetween(r.eid, today) < 0) continue;
    const next = ramadanOf(year + 1, adjustments);
    if (next && daysBetween(next.first, today) >= 0) return null;
    return r;
  }
  return null;
}

/** The next Ramadan's first day from `today` on (null while Ramadan is on). */
export function nextRamadan(today: string, adjustments: Adjustment[] = []): RamadanDays | null {
  const y = toHijri(today).year;
  for (const year of [y - 1, y, y + 1]) {
    const r = ramadanOf(year, adjustments);
    if (!r) continue;
    if (daysBetween(r.first, today) >= 0 && daysBetween(today, r.eid) > 0) return null; // in Ramadan
    if (daysBetween(today, r.first) > 0) return r;
  }
  return null;
}

const abs = (m: Moment, base: string) => daysBetween(base, m.day) * 1440 + m.min;

/** How many of Ramadan's days her excuses took (each day once, however many excuses touch it). */
export function excusedRamadanDays(r: RamadanDays, excuses: ExcuseSpan[], hours: FastHours): number {
  let n = 0;
  for (let d = r.first; daysBetween(d, r.eid) > 0; d = addDays(d, 1)) {
    const h = hours(d) ?? { from: 0, to: 1440 };
    const a = abs({ day: d, min: h.from }, r.first);
    const b = abs({ day: d, min: h.to }, r.first);
    if (excuses.some((e) => Math.max(a, abs(e.start, r.first)) < Math.min(b, abs(e.end, r.first)))) n++;
  }
  return n;
}
