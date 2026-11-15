import { LIMITS, PRAYERS, isPrayer, type PrayerKind } from "./kinds";

// «القضاء»: the estimate («حاسبة التقدير»). An estimate only — the site makes
// no fiqh ruling; the result is a preview she edits before saving. Pure.
//
// Prayers: every month counts 30 days. «استثناء رمضان» leaves one month out
// per whole year. For a woman, her usual excuse days come off every month
// counted. Fasting: a woman's Ramadans × her excuse days; a man types the
// days himself.

export const DAYS_PER_MONTH = 30;

export type EstimateInput = {
  // the prayers she owes (all five, or some, e.g. الفجر only); none: no prayer part
  prayers: PrayerKind[];
  years: number;
  months: number;
  excludeRamadan: boolean;
  // a woman: «كم يوم العذر في الشهر تقريبًا؟» (0–15); null for a man
  excuseDays: number | null;
  // fasting — a woman: how many Ramadans; a man: the days themselves
  ramadans: number;
  fastDays: number;
};

export type EstimateResult = { prayers: Partial<Record<PrayerKind, number>>; fast: number };

/** The days of prayer owed: months × 30, less Ramadan (one month per whole year) and her excuse days in each month counted. */
export function prayerDays(i: Pick<EstimateInput, "years" | "months" | "excludeRamadan" | "excuseDays">): number {
  const months = i.years * 12 + i.months;
  const counted = months - (i.excludeRamadan ? Math.floor(months / 12) : 0);
  return Math.max(0, counted * (DAYS_PER_MONTH - Math.min(i.excuseDays ?? 0, DAYS_PER_MONTH)));
}

export function estimate(i: EstimateInput): EstimateResult {
  const days = prayerDays(i);
  const prayers: Partial<Record<PrayerKind, number>> = {};
  if (days > 0) for (const p of i.prayers) prayers[p] = days;
  const fast = i.excuseDays !== null ? i.ramadans * Math.min(i.excuseDays, DAYS_PER_MONTH) : i.fastDays;
  return { prayers, fast: Math.max(0, fast) };
}

const int = (v: unknown, max: number): number | null => {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : NaN;
  return Number.isInteger(n) && n >= 0 && n <= max ? n : null;
};

/**
 * Her answers as sent (also the stored JSON, read back), checked. woman: she
 * is asked about her excuse days and her Ramadans; a man never sends them
 * (they're ignored if he does). null: something is out of range.
 */
export function parseEstimate(raw: unknown, woman: boolean): EstimateInput | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const prayers = Array.isArray(r.prayers) ? PRAYERS.filter((p) => (r.prayers as unknown[]).includes(p)) : null;
  if (!prayers || (Array.isArray(r.prayers) && !(r.prayers as unknown[]).every(isPrayer))) return null;
  const years = int(r.years, LIMITS.maxYears);
  const months = int(r.months, 11);
  if (years === null || months === null) return null;
  const excuseDays = woman ? int(r.excuseDays, LIMITS.maxExcuseDays) : null;
  if (woman && excuseDays === null) return null;
  const ramadans = woman ? int(r.ramadans, LIMITS.maxRamadans) : 0;
  const fastDays = woman ? 0 : int(r.fastDays, LIMITS.maxCount);
  if (ramadans === null || fastDays === null) return null;
  return { prayers, years, months, excludeRamadan: r.excludeRamadan !== false, excuseDays, ramadans, fastDays };
}

/** The preview after her edits: each count 0–100,000 (0 = left out). null: out of range. */
export function parsePreview(raw: unknown): EstimateResult | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const p = (r.prayers ?? {}) as Record<string, unknown>;
  if (typeof p !== "object" || Object.keys(p).some((k) => !isPrayer(k))) return null;
  const prayers: Partial<Record<PrayerKind, number>> = {};
  for (const k of PRAYERS) {
    if (p[k] === undefined) continue;
    const n = int(p[k], LIMITS.maxCount);
    if (n === null) return null;
    if (n > 0) prayers[k] = n;
  }
  const fast = r.fast === undefined ? 0 : int(r.fast, LIMITS.maxCount);
  if (fast === null) return null;
  return { prayers, fast };
}
