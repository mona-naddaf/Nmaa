// The recurring Hijri occasions and how a course's calendar is assembled
// from them. Pure (no DB, no "today" of its own), so the same code runs on
// the server for validation and in the browser, which owns "today".

import { addDays, daysBetween, fromHijri, toHijri } from "./hijri";

export type Occasion =
  | "RAMADAN_START"
  | "EID_FITR"
  | "ARAFAH"
  | "EID_ADHA"
  | "HIJRI_NEW_YEAR"
  | "ASHURA"
  | "ISRA_MIRAJ"
  | "MID_SHABAN";

type OccasionDef = {
  name: string;
  month: number;
  day: number;
  // core occasions are always shown while the calendar is enabled; optional
  // ones only once the course turns them on
  core: boolean;
  todayMessage: string;
};

export const OCCASIONS: Record<Occasion, OccasionDef> = {
  RAMADAN_START: {
    name: "بداية شهر رمضان",
    month: 9,
    day: 1,
    core: true,
    todayMessage: "اليوم أول أيام شهر رمضان — رمضان مبارك",
  },
  EID_FITR: {
    name: "عيد الفطر",
    month: 10,
    day: 1,
    core: true,
    todayMessage: "اليوم عيد الفطر — تقبّل الله منا ومنكم",
  },
  ARAFAH: { name: "يوم عرفة", month: 12, day: 9, core: true, todayMessage: "اليوم يوم عرفة" },
  EID_ADHA: {
    name: "عيد الأضحى",
    month: 12,
    day: 10,
    core: true,
    todayMessage: "اليوم عيد الأضحى — تقبّل الله منا ومنكم",
  },
  HIJRI_NEW_YEAR: {
    name: "رأس السنة الهجرية",
    month: 1,
    day: 1,
    core: false,
    todayMessage: "اليوم رأس السنة الهجرية",
  },
  ASHURA: { name: "يوم عاشوراء", month: 1, day: 10, core: false, todayMessage: "اليوم يوم عاشوراء" },
  ISRA_MIRAJ: {
    name: "ذكرى الإسراء والمعراج",
    month: 7,
    day: 27,
    core: false,
    todayMessage: "اليوم ذكرى الإسراء والمعراج",
  },
  MID_SHABAN: { name: "منتصف شعبان", month: 8, day: 15, core: false, todayMessage: "اليوم منتصف شعبان" },
};

export const ALL_OCCASIONS = Object.keys(OCCASIONS) as Occasion[];
export const CORE_OCCASIONS = ALL_OCCASIONS.filter((o) => OCCASIONS[o].core);
export const OPTIONAL_OCCASIONS = ALL_OCCASIONS.filter((o) => !OCCASIONS[o].core);

export function isOptionalOccasion(value: string): value is Occasion {
  return (OPTIONAL_OCCASIONS as string[]).includes(value);
}

export function isOccasion(value: string): value is Occasion {
  return (ALL_OCCASIONS as string[]).includes(value);
}

export const MAX_ADJUSTMENT_DAYS = 2;

/**
 * Hijri years whose occurrence the supervisor may still shift, given
 * today's Hijri year: the current one and the next (D9). Together these
 * always include the next upcoming occurrence of every occasion.
 */
export function adjustableYears(todayHijriYear: number): number[] {
  return [todayHijriYear, todayHijriYear + 1];
}

// ---------- Assembling a course's calendar ----------

export type Adjustment = { occasion: Occasion; hijriYear: number; offsetDays: number };

export type CustomEvent = {
  id: string;
  title: string;
  description: string | null;
  date: string;
  // computed server-side from the viewer's role and ownership (D8)
  editable: boolean;
};

export type CalendarItem =
  | {
      kind: "occasion";
      key: string;
      occasion: Occasion;
      hijriYear: number;
      // the Umm al-Qura day before any adjustment
      baseDate: string;
      date: string;
      offsetDays: number;
    }
  | { kind: "event"; key: string; event: CustomEvent; date: string };

export function activeOccasions(enabledOptional: Occasion[]): Occasion[] {
  return ALL_OCCASIONS.filter((o) => OCCASIONS[o].core || enabledOptional.includes(o));
}

export function occasionOccurrence(
  occasion: Occasion,
  hijriYear: number,
  adjustments: Adjustment[],
): Extract<CalendarItem, { kind: "occasion" }> | null {
  const def = OCCASIONS[occasion];
  const baseDate = fromHijri(hijriYear, def.month, def.day);
  if (!baseDate) return null;
  const offsetDays =
    adjustments.find((a) => a.occasion === occasion && a.hijriYear === hijriYear)?.offsetDays ?? 0;
  return {
    kind: "occasion",
    key: `${occasion}-${hijriYear}`,
    occasion,
    hijriYear,
    baseDate,
    date: addDays(baseDate, offsetDays),
    offsetDays,
  };
}

/** Every item (occasions + custom events) dated within [from, to], sorted. */
export function itemsInRange(
  from: string,
  to: string,
  occasions: Occasion[],
  adjustments: Adjustment[],
  events: CustomEvent[],
): CalendarItem[] {
  const firstYear = toHijri(from).year - 1;
  const lastYear = toHijri(to).year + 1;
  const items: CalendarItem[] = [];
  for (let y = firstYear; y <= lastYear; y++) {
    for (const o of occasions) {
      const occ = occasionOccurrence(o, y, adjustments);
      if (occ && occ.date >= from && occ.date <= to) items.push(occ);
    }
  }
  for (const e of events) {
    if (e.date >= from && e.date <= to) items.push({ kind: "event", key: e.id, event: e, date: e.date });
  }
  return sortItems(items);
}

/**
 * Upcoming items from `today` on (today included): the next occurrence of
 * each active occasion, plus every custom event on or after today.
 */
export function upcomingItems(
  today: string,
  occasions: Occasion[],
  adjustments: Adjustment[],
  events: CustomEvent[],
): CalendarItem[] {
  const year = toHijri(today).year;
  const items: CalendarItem[] = [];
  for (const o of occasions) {
    // an adjustment can pull last year's late-in-year occasion past today's
    // year boundary, so start one year back
    for (let y = year - 1; y <= year + 1; y++) {
      const occ = occasionOccurrence(o, y, adjustments);
      if (occ && occ.date >= today) {
        items.push(occ);
        break;
      }
    }
  }
  for (const e of events) {
    if (e.date >= today) items.push({ kind: "event", key: e.id, event: e, date: e.date });
  }
  return sortItems(items);
}

function sortItems(items: CalendarItem[]): CalendarItem[] {
  // same day: occasions before custom events, then in catalog / title order
  const rank = (i: CalendarItem) => (i.kind === "occasion" ? ALL_OCCASIONS.indexOf(i.occasion) : 100);
  return items.sort(
    (a, b) =>
      a.date.localeCompare(b.date) ||
      rank(a) - rank(b) ||
      (a.kind === "event" && b.kind === "event" ? a.event.title.localeCompare(b.event.title, "ar") : 0),
  );
}

export function itemTitle(item: CalendarItem): string {
  return item.kind === "occasion" ? OCCASIONS[item.occasion].name : item.event.title;
}

export function todayMessage(item: CalendarItem): string {
  return item.kind === "occasion" ? OCCASIONS[item.occasion].todayMessage : `اليوم: ${item.event.title}`;
}

export function daysUntil(today: string, item: CalendarItem): number {
  return daysBetween(today, item.date);
}

/** "مؤخَّر يومًا" / "مقدَّم يومين" — how a shifted occurrence moved. */
export function adjustmentLabel(offsetDays: number): string {
  const dir = offsetDays > 0 ? "مؤخَّر" : "مقدَّم";
  return `${dir} ${Math.abs(offsetDays) === 1 ? "يومًا" : "يومين"}`;
}
