import surahsJson from "./surahs.json";
import pageMapJson from "./page-map.json";

export interface Surah {
  number: number;
  name: string;
  ayahs: number;
  juz: number;
}

// [pageFraction, pageStart, pageEnd] for one ayah
export type AyahPageEntry = [number, number, number];

export const TOTAL_PAGES = 604;

export const SURAHS: Surah[] = surahsJson as Surah[];

export const SURAH_BY_NUMBER: Record<number, Surah> = Object.fromEntries(
  SURAHS.map((s) => [s.number, s]),
);

export const SURAH_NAME: Record<number, string> = Object.fromEntries(
  SURAHS.map((s) => [s.number, s.name]),
);

export const AYAH_COUNT: Record<number, number> = Object.fromEntries(
  SURAHS.map((s) => [s.number, s.ayahs]),
);

// keyed by surah number as string, matching the source data
const PAGE_MAP = pageMapJson as unknown as Record<string, AyahPageEntry[]>;

export function getAyahPageEntries(surahNumber: number): AyahPageEntry[] | undefined {
  return PAGE_MAP[String(surahNumber)];
}

export const MUSHAF_ORDER: number[] = SURAHS.map((s) => s.number);

// shortest-surahs-first, as used by the "جزء عمّ بالعكس" template (juz 30, descending)
export const JUZ_AMMA_REVERSE_ORDER: number[] = SURAHS.filter((s) => s.juz === 30)
  .map((s) => s.number)
  .sort((a, b) => b - a);
