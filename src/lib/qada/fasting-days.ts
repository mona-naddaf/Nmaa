import { addDays, daysBetween, toHijri, weekday } from "@/lib/calendar/hijri";
import { occasionOccurrence, type Adjustment } from "@/lib/calendar/occasions";

// «القضاء»: which days the fasting plan and its suggestions leave out, and
// the gentle suggestions themselves. Pure. Her calendar's moon-sighting
// shifts (Ramadan's start, the Eids) move these days with them.
//
// Left out (Mona, 2026-11-15): Ramadan, both Eid days, 11–13 ذو الحجة and
// the last day of شعبان. This only shapes the plan and the suggestions:
// logging a made-up fast on any day is always allowed, with no warning.

/** The days left out between from and to (both included). */
export function blockedFastDays(from: string, to: string, adjustments: Adjustment[] = []): Set<string> {
  const out = new Set<string>();
  if (daysBetween(from, to) < 0) return out;
  const first = toHijri(from).year - 1;
  const last = toHijri(to).year + 1;
  const add = (day: string) => {
    if (daysBetween(from, day) >= 0 && daysBetween(day, to) >= 0) out.add(day);
  };
  for (let y = first; y <= last; y++) {
    const ramadan = occasionOccurrence("RAMADAN_START", y, adjustments)?.date;
    const fitr = occasionOccurrence("EID_FITR", y, adjustments)?.date;
    const adha = occasionOccurrence("EID_ADHA", y, adjustments)?.date;
    if (ramadan) {
      // the day before Ramadan
      add(addDays(ramadan, -1));
      // Ramadan itself, up to the Eid (or 30 days when the Eid can't be placed)
      const end = fitr ?? addDays(ramadan, 30);
      for (let d = ramadan; daysBetween(d, end) > 0; d = addDays(d, 1)) add(d);
    }
    if (fitr) add(fitr);
    // the Eid and the three days after it
    if (adha) for (let i = 0; i <= 3; i++) add(addDays(adha, i));
  }
  return out;
}

export type SuggestionReason = "MONDAY" | "THURSDAY" | "WHITE";
export type FastSuggestion = { day: string; reasons: SuggestionReason[] };

/**
 * The suggested days from `from` on, at most `limit` of them, within `days`
 * days: Mondays, Thursdays and الأيام البيض (13–15), without the days left
 * out. Suggestions only; any day she logs counts.
 */
export function fastSuggestions(from: string, days: number, blocked: Set<string>, limit = 4): FastSuggestion[] {
  const out: FastSuggestion[] = [];
  for (let i = 0; i < days && out.length < limit; i++) {
    const day = addDays(from, i);
    if (blocked.has(day)) continue;
    const reasons: SuggestionReason[] = [];
    const w = weekday(day);
    if (w === 1) reasons.push("MONDAY");
    if (w === 4) reasons.push("THURSDAY");
    const h = toHijri(day).day;
    if (h >= 13 && h <= 15) reasons.push("WHITE");
    if (reasons.length) out.push({ day, reasons });
  }
  return out;
}
