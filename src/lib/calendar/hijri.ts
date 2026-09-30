// Hijri (Umm al-Qura) <-> Gregorian conversion and Arabic date labels.
// Runs on both server and browser: Intl's "islamic-umalqura" calendar ships
// with Node (full ICU) and every modern browser, and its tables cover
// 1300–1600 AH.
//
// Every calendar day is passed around as a Gregorian "YYYY-MM-DD" string,
// never a Date: a civil day has no time zone, and the browser decides which
// day is "today" (see useToday.ts).

export type HijriDate = { year: number; month: number; day: number };

const DAY_MS = 24 * 60 * 60 * 1000;

const hijriFormat = new Intl.DateTimeFormat("en-u-ca-islamic-umalqura-nu-latn", {
  timeZone: "UTC",
  year: "numeric",
  month: "numeric",
  day: "numeric",
});

export const HIJRI_MONTHS = [
  "محرم",
  "صفر",
  "ربيع الأول",
  "ربيع الآخر",
  "جمادى الأولى",
  "جمادى الآخرة",
  "رجب",
  "شعبان",
  "رمضان",
  "شوال",
  "ذو القعدة",
  "ذو الحجة",
];

export const GREGORIAN_MONTHS = [
  "يناير",
  "فبراير",
  "مارس",
  "أبريل",
  "مايو",
  "يونيو",
  "يوليو",
  "أغسطس",
  "سبتمبر",
  "أكتوبر",
  "نوفمبر",
  "ديسمبر",
];

// Sunday-first, matching the Saudi week
export const WEEKDAYS = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];

// ---------- ISO day strings ----------

export function isoToUtc(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

export function utcToIso(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/** Strict "YYYY-MM-DD" check (real calendar day, sane year range). */
export function isValidIso(iso: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
  const [y, m, d] = iso.split("-").map(Number);
  if (y < 1900 || y > 2150) return false;
  return utcToIso(Date.UTC(y, m - 1, d)) === iso;
}

export function addDays(iso: string, days: number): string {
  return utcToIso(isoToUtc(iso) + days * DAY_MS);
}

/** Whole days from `from` to `to` (negative when `to` is earlier). */
export function daysBetween(from: string, to: string): number {
  return Math.round((isoToUtc(to) - isoToUtc(from)) / DAY_MS);
}

/** 0 = Sunday … 6 = Saturday */
export function weekday(iso: string): number {
  return new Date(isoToUtc(iso)).getUTCDay();
}

// ---------- Conversion ----------

export function toHijri(iso: string): HijriDate {
  const parts = hijriFormat.formatToParts(new Date(isoToUtc(iso)));
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return { year: get("year"), month: get("month"), day: get("day") };
}

// 1 Muharram 1 AH, proleptic Gregorian; only used to aim the search below
const HIJRI_EPOCH_MS = Date.UTC(622, 6, 19);
const MEAN_YEAR = 354.36667;
const MEAN_MONTH = 29.53059;

/**
 * Gregorian day of a Hijri date, or null when that day doesn't exist (e.g.
 * 30 of a 29-day month). Intl only formats Gregorian -> Hijri, so this aims
 * with the mean lunar month and then checks the nearby days.
 */
export function fromHijri(year: number, month: number, day: number): string | null {
  if (month < 1 || month > 12 || day < 1 || day > 30) return null;
  const estimate = Math.round((year - 1) * MEAN_YEAR + (month - 1) * MEAN_MONTH + (day - 1));
  const center = utcToIso(HIJRI_EPOCH_MS + estimate * DAY_MS);
  for (let i = 0; i <= 10; i++) {
    for (const offset of i === 0 ? [0] : [i, -i]) {
      const iso = addDays(center, offset);
      const h = toHijri(iso);
      if (h.year === year && h.month === month && h.day === day) return iso;
    }
  }
  return null;
}

export function hijriMonthLength(year: number, month: number): number {
  return fromHijri(year, month, 30) ? 30 : 29;
}

/** Hijri month after (or with delta<0, before) the given one. */
export function shiftHijriMonth(year: number, month: number, delta: number): { year: number; month: number } {
  const index = year * 12 + (month - 1) + delta;
  return { year: Math.floor(index / 12), month: (index % 12) + 1 };
}

// ---------- Labels (Latin digits, like the rest of the app) ----------

export function hijriLabel(h: HijriDate): string {
  return `${h.day} ${HIJRI_MONTHS[h.month - 1]} ${h.year} هـ`;
}

export function gregorianLabel(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return `${d} ${GREGORIAN_MONTHS[m - 1]} ${y}`;
}

/** e.g. "الجمعة 20 مارس 2026" */
export function gregorianLabelWithWeekday(iso: string): string {
  return `${WEEKDAYS[weekday(iso)]} ${gregorianLabel(iso)}`;
}

// Arabic counted-noun agreement for "يوم", written with digits: 3–10 take
// the plural (أيام), 11–99 the accusative singular (يومًا), and 100, 200, …
// plus x01/x02 the plain singular (يوم) — then the last two digits decide.
function daysNoun(n: number): string {
  const r = n % 100;
  if (n >= 100 && r <= 2) return "يوم";
  if (r >= 3 && r <= 10) return "أيام";
  return "يومًا";
}

/** "اليوم" / "غدًا" / "بعد يومين" / "بعد 5 أيام" / "بعد 12 يومًا" */
export function countdownLabel(days: number): string {
  if (days === 0) return "اليوم";
  if (days === 1) return "غدًا";
  if (days === 2) return "بعد يومين";
  return `بعد ${days} ${daysNoun(days)}`;
}
