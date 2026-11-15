// «القضاء»: the kinds of qada and their names. Pure; shared by the server and
// the card.

export const PRAYERS = ["FAJR", "DHUHR", "ASR", "MAGHRIB", "ISHA"] as const;
export type PrayerKind = (typeof PRAYERS)[number];
export type QadaKind = PrayerKind | "FAST";
export const KINDS: readonly QadaKind[] = [...PRAYERS, "FAST"];

export type QadaAction = "OWED" | "MADE_UP";

/** The two goals and the two lines of milestones: the five prayers together, and fasting. */
export type QadaTrack = "prayers" | "fast";
export const trackOf = (k: QadaKind): QadaTrack => (k === "FAST" ? "fast" : "prayers");

export const isPrayer = (v: unknown): v is PrayerKind => typeof v === "string" && (PRAYERS as readonly string[]).includes(v);
export const isQadaKind = (v: unknown): v is QadaKind => v === "FAST" || isPrayer(v);

export const KIND_NAMES: Record<QadaKind, string> = {
  FAJR: "الفجر",
  DHUHR: "الظهر",
  ASR: "العصر",
  MAGHRIB: "المغرب",
  ISHA: "العشاء",
  FAST: "الصيام",
};

// the short form inside a sentence («اليوم: 2 فجر، 1 ظهر»)
export const KIND_SHORT: Record<QadaKind, string> = {
  FAJR: "فجر",
  DHUHR: "ظهر",
  ASR: "عصر",
  MAGHRIB: "مغرب",
  ISHA: "عشاء",
  FAST: "صيام",
};

export const LIMITS = {
  // one entry's count (the database checks the same)
  maxCount: 100_000,
  // «في يوم سابق»
  backDays: 7,
  // «+ عدد»: at most this many in one entry
  maxMadeUp: 100,
  // «يوم كامل»
  maxFullDays: 20_000,
  // the estimate
  maxYears: 80,
  maxRamadans: 80,
  maxExcuseDays: 15,
  // «وتيرة»
  maxPrayerPace: 50,
  maxFastPace: 7,
  // «السجل»: the latest lines shown
  logLines: 300,
  // «تراجع»
  undoMs: 10_000,
} as const;
