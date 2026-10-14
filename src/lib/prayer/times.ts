// Prayer times for «الجدول اليومي» (prayer-anchored items, the timeline's
// markers), computed locally with adhan — no external service. Client-safe.
//
// A location carries its calculation method and Asr school. Defaults by
// country (agreed): Umm al-Qura for Saudi Arabia (Isha 120 minutes after
// Maghrib in Ramadan instead of 90, handled here explicitly), Egyptian for
// Egypt, the Dubai/Qatar/Kuwait methods there, Diyanet for Turkey, custom
// angles for Morocco (19°/17°), Algeria (18°/17°) and Tunisia (18°/18°),
// Muslim World League elsewhere. Asr: Shafi'i by default, Hanafi optional.

import { CalculationMethod, Coordinates, HighLatitudeRule, Madhab, PrayerTimes, type CalculationParameters } from "adhan";
import { toHijri } from "@/lib/calendar/hijri";
import { zoneDayStart } from "@/lib/time/zone";

export type Prayer = "FAJR" | "SUNRISE" | "DHUHR" | "ASR" | "MAGHRIB" | "ISHA";
export const PRAYERS: Prayer[] = ["FAJR", "SUNRISE", "DHUHR", "ASR", "MAGHRIB", "ISHA"];
export const PRAYER_NAME: Record<Prayer, string> = {
  FAJR: "الفجر",
  SUNRISE: "الشروق",
  DHUHR: "الظهر",
  ASR: "العصر",
  MAGHRIB: "المغرب",
  ISHA: "العشاء",
};
export const isPrayer = (v: unknown): v is Prayer => typeof v === "string" && (PRAYERS as string[]).includes(v);

export type MethodKey =
  | "UMM_AL_QURA"
  | "EGYPTIAN"
  | "DUBAI"
  | "QATAR"
  | "KUWAIT"
  | "TURKEY"
  | "MOROCCO"
  | "ALGERIA"
  | "TUNISIA"
  | "MWL"
  | "NORTH_AMERICA"
  | "KARACHI"
  | "SINGAPORE";

export const METHOD_LABEL: Record<MethodKey, string> = {
  UMM_AL_QURA: "أم القرى",
  EGYPTIAN: "الهيئة المصرية العامة للمساحة",
  DUBAI: "دبي",
  QATAR: "قطر",
  KUWAIT: "الكويت",
  TURKEY: "رئاسة الشؤون الدينية التركية",
  MOROCCO: "المغرب (19° / 17°)",
  ALGERIA: "الجزائر (18° / 17°)",
  TUNISIA: "تونس (18° / 18°)",
  MWL: "رابطة العالم الإسلامي",
  NORTH_AMERICA: "أمريكا الشمالية (ISNA)",
  KARACHI: "جامعة العلوم الإسلامية بكراتشي",
  SINGAPORE: "سنغافورة",
};
export const METHODS = Object.keys(METHOD_LABEL) as MethodKey[];
export const isMethod = (v: unknown): v is MethodKey => typeof v === "string" && (METHODS as string[]).includes(v);

export type AsrSchool = "SHAFI" | "HANAFI";
export const ASR_LABEL: Record<AsrSchool, string> = { SHAFI: "الجمهور (المِثل)", HANAFI: "الحنفي (المِثلان)" };
export const isAsr = (v: unknown): v is AsrSchool => v === "SHAFI" || v === "HANAFI";

/** The default method for a country (ISO code). */
export function defaultMethod(country: string | null | undefined): MethodKey {
  switch (country) {
    case "SA":
      return "UMM_AL_QURA";
    case "EG":
      return "EGYPTIAN";
    case "AE":
      return "DUBAI";
    case "QA":
      return "QATAR";
    case "KW":
      return "KUWAIT";
    case "TR":
      return "TURKEY";
    case "MA":
      return "MOROCCO";
    case "DZ":
      return "ALGERIA";
    case "TN":
      return "TUNISIA";
    default:
      return "MWL";
  }
}

/** Where the prayer times are computed for. key: a city of cities.ts, or null for «موقع مخصّص». */
export interface PrayerLocation {
  key: string | null;
  name: string;
  lat: number;
  lng: number;
  method: MethodKey;
  asr: AsrSchool;
}

function custom(fajr: number, isha: number): CalculationParameters {
  const p = CalculationMethod.Other();
  p.fajrAngle = fajr;
  p.ishaAngle = isha;
  return p;
}

function parameters(method: MethodKey, ramadan: boolean): CalculationParameters {
  switch (method) {
    case "UMM_AL_QURA": {
      const p = CalculationMethod.UmmAlQura();
      // Umm al-Qura: Isha 90 minutes after Maghrib, 120 in Ramadan
      if (ramadan) p.ishaInterval = 120;
      return p;
    }
    case "EGYPTIAN":
      return CalculationMethod.Egyptian();
    case "DUBAI":
      return CalculationMethod.Dubai();
    case "QATAR":
      return CalculationMethod.Qatar();
    case "KUWAIT":
      return CalculationMethod.Kuwait();
    case "TURKEY":
      return CalculationMethod.Turkey();
    case "MOROCCO":
      return custom(19, 17);
    case "ALGERIA":
      return custom(18, 17);
    case "TUNISIA":
      return custom(18, 18);
    case "NORTH_AMERICA":
      return CalculationMethod.NorthAmerica();
    case "KARACHI":
      return CalculationMethod.Karachi();
    case "SINGAPORE":
      return CalculationMethod.Singapore();
    default:
      return CalculationMethod.MuslimWorldLeague();
  }
}

/** The six times of a civil day ("YYYY-MM-DD") at a location, as instants. */
export function prayerInstants(loc: PrayerLocation, day: string): Record<Prayer, Date> {
  const [y, m, d] = day.split("-").map(Number);
  const coords = new Coordinates(loc.lat, loc.lng);
  const params = parameters(loc.method, toHijri(day).month === 9);
  params.madhab = loc.asr === "HANAFI" ? Madhab.Hanafi : Madhab.Shafi;
  // far from the equator, twilight may never reach the angles: the recommended rule
  params.highLatitudeRule = HighLatitudeRule.recommended(coords);
  // adhan reads the date's local year/month/day, whatever the runtime's zone
  const t = new PrayerTimes(coords, new Date(y, m - 1, d), params);
  return { FAJR: t.fajr, SUNRISE: t.sunrise, DHUHR: t.dhuhr, ASR: t.asr, MAGHRIB: t.maghrib, ISHA: t.isha };
}

/**
 * The six times as minutes after the day's midnight — in the course's time
 * zone, or (tz null: «رفيق الحفظ») the browser's. A time past midnight (a
 * late Isha in a northern summer) is more than 1440.
 */
export function prayerMinutes(loc: PrayerLocation, day: string, tz: string | null): Record<Prayer, number> {
  const start = tz ? zoneDayStart(tz, day).getTime() : new Date(...(day.split("-").map(Number).map((n, i) => (i === 1 ? n - 1 : n)) as [number, number, number])).getTime();
  const at = prayerInstants(loc, day);
  const out = {} as Record<Prayer, number>;
  for (const p of PRAYERS) out[p] = Math.round((at[p].getTime() - start) / 60000);
  return out;
}

/** A location as submitted: a real place, method and school; null when not. */
export function validateLocation(input: unknown): PrayerLocation | null {
  if (!input || typeof input !== "object") return null;
  const v = input as Record<string, unknown>;
  const name = typeof v.name === "string" ? v.name.replace(/\s+/g, " ").trim() : "";
  const lat = Number(v.lat);
  const lng = Number(v.lng);
  if (!name || name.length > 60) return null;
  if (!Number.isFinite(lat) || lat < -90 || lat > 90 || !Number.isFinite(lng) || lng < -180 || lng > 180) return null;
  if (!isMethod(v.method) || !isAsr(v.asr)) return null;
  const key = typeof v.key === "string" && v.key ? v.key : null;
  return { key, name, lat: Math.round(lat * 1e5) / 1e5, lng: Math.round(lng * 1e5) / 1e5, method: v.method, asr: v.asr };
}
