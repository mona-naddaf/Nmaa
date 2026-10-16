import "server-only";
import { wordAfter, wordAt } from "@/lib/quran-data/quran-text";
import { splitLetters } from "@/lib/tajweed/letters";
import { isValidSpot, spotKey } from "@/lib/tajweed/spots";
import { MISTAKE_TYPES, type MistakeType } from "@/lib/students/mistake-types";

// Server-side check of the words flagged as mistakes in one session, shared
// by the course's recitation form and «رفيق الحفظ».

// a whole long surah is ~6000 words; anything beyond this isn't a real entry
const MAX_MISTAKES_PER_SESSION = 2000;

export interface FlaggedWordInput {
  ayah: number;
  wordPosition: number;
  type: MistakeType;
}

export type FlaggedWord = FlaggedWordInput & { wordText: string };

/** A spot whose earlier mistakes are mastered: letter 0 + no gap = the whole word. */
export interface MasteredSpot {
  ayah: number;
  wordPosition: number;
  letter: number;
  gapAfter: boolean;
}

/** Each must be a real word inside this session's surah and range, flagged once. */
export function validateFlaggedWords(
  raw: unknown,
  surahNumber: number,
  fromAyah: number,
  toAyah: number,
): { error: string } | { words: FlaggedWord[] } {
  const flagged = (Array.isArray(raw) ? raw : []) as FlaggedWordInput[];
  if (flagged.length > MAX_MISTAKES_PER_SESSION) return { error: "عدد الكلمات المحدّدة كبير جدًا" };
  const words: FlaggedWord[] = [];
  const seen = new Set<string>();
  for (const m of flagged) {
    const key = `${m?.ayah}:${m?.wordPosition}`;
    const inRange = Number.isInteger(m?.ayah) && m.ayah >= fromAyah && m.ayah <= toAyah;
    const wordText = inRange && Number.isInteger(m.wordPosition) ? wordAt(surahNumber, m.ayah, m.wordPosition) : null;
    if (!wordText || !MISTAKE_TYPES.includes(m.type) || seen.has(key)) {
      return { error: "بيانات الكلمات المحدّدة كأخطاء غير صحيحة" };
    }
    seen.add(key);
    words.push({ ayah: m.ayah, wordPosition: m.wordPosition, type: m.type, wordText });
  }
  return { words };
}

/**
 * Spots whose earlier mistakes the teacher marked «تم الإتقان» in this
 * session's form: each a real word inside the range — the whole word (no
 * letter or gap given: every form before detailed tajweed), one of its
 * letters, or the gap after it (lib/tajweed/spots.ts) — listed once.
 */
export function validateMasteredWords(
  raw: unknown,
  surahNumber: number,
  fromAyah: number,
  toAyah: number,
): { error: string } | { words: MasteredSpot[] } {
  const list = (Array.isArray(raw) ? raw : []) as Partial<MasteredSpot>[];
  if (list.length > MAX_MISTAKES_PER_SESSION) return { error: "عدد الكلمات المحدّدة كبير جدًا" };
  const words: MasteredSpot[] = [];
  const seen = new Set<string>();
  const invalid = { error: "بيانات الكلمات المُتقَنة غير صحيحة" };
  for (const m of list) {
    const ayah = m?.ayah;
    const wordPosition = m?.wordPosition;
    const letter = m?.letter ?? 0;
    const gapAfter = m?.gapAfter === true;
    const inRange = Number.isInteger(ayah) && ayah! >= fromAyah && ayah! <= toAyah;
    const wordText = inRange && Number.isInteger(wordPosition) ? wordAt(surahNumber, ayah!, wordPosition!) : null;
    if (!wordText || !Number.isInteger(letter) || !isValidSpot({ letter, gapAfter })) return invalid;
    if (letter > 0 && letter > splitLetters(wordText).length) return invalid;
    if (gapAfter && !wordAfter(surahNumber, ayah!, wordPosition!)) return invalid;
    const key = spotKey(surahNumber, ayah!, wordPosition!, { letter, gapAfter });
    if (seen.has(key)) return invalid;
    seen.add(key);
    words.push({ ayah: ayah!, wordPosition: wordPosition!, letter, gapAfter });
  }
  return { words };
}
