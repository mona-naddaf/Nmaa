import "server-only";
import { wordAt } from "@/lib/quran-data/quran-text";
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
