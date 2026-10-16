import "server-only";
import quranText from "./quran-uthmani.json";
import { splitAyah } from "./words";

// Server-side access to the verbatim Tanzil Uthmani text (see
// scripts/import-tanzil-text.mjs). Server-only so the ~1.4 MB text never
// lands in a client bundle; the browser fetches one surah at a time from
// /api/quran-text/[surah].

const TEXT = quranText as { notice: string; source: string; surahs: string[][] };

export const QURAN_TEXT_SOURCE = TEXT.source;

/** The ayat of one surah, verbatim, or null for an invalid surah number. */
export function surahText(surahNumber: number): string[] | null {
  return TEXT.surahs[surahNumber - 1] ?? null;
}

/**
 * The word after (surah, ayah, position): the next one in the ayah, or the
 * first word of the next ayah (the basmala is never counted). null at the
 * end of the surah or for a word that doesn't exist.
 */
export function wordAfter(surahNumber: number, ayah: number, position: number): { ayah: number; position: number; text: string } | null {
  const ayat = surahText(surahNumber);
  const text = ayat?.[ayah - 1];
  if (!ayat || !text) return null;
  const words = splitAyah(surahNumber, ayah, text).words;
  if (!words[position - 1]) return null;
  if (words[position]) return { ayah, position: position + 1, text: words[position].text };
  const next = ayat[ayah];
  if (!next) return null;
  const first = splitAyah(surahNumber, ayah + 1, next).words[0];
  return first ? { ayah: ayah + 1, position: 1, text: first.text } : null;
}

/** The word at (surah, ayah, position), or null when there's no such word. */
export function wordAt(surahNumber: number, ayah: number, position: number): string | null {
  const text = surahText(surahNumber)?.[ayah - 1];
  if (!text) return null;
  return splitAyah(surahNumber, ayah, text).words[position - 1]?.text ?? null;
}
