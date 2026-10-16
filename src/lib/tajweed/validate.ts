import "server-only";
import { wordAfter, wordAt } from "@/lib/quran-data/quran-text";
import { splitLetters } from "./letters";
import { isConfusionLetter, makharijFor } from "./letter-facts";
import { GENERAL, isCodeFor, type SpotTarget, type TajweedKind } from "./taxonomy";
import { addDetail, isValidSpot, spotKey, type DetailError } from "./spots";

// Server-side check of detailed tajweed mistakes (src/lib/tajweed), shared
// by the course's recitation form and, later, «رفيق الحفظ» and the home
// self-marks. Never trusts the client: every word, letter, gap, code and
// «قريبًا من حرف» is checked against the bundled text and the taxonomy.

// a whole long surah is ~6000 words; a detailed entry beyond this isn't real
export const MAX_DETAILS_PER_SESSION = 2000;

export interface DetailInput {
  ayah: number;
  wordPosition: number;
  /** 0 with gapAfter; 1..n a letter unit */
  letter: number;
  gapAfter: boolean;
  kind: TajweedKind;
  code: string;
  confusedWith: string | null;
}

export interface CheckedDetail extends DetailInput {
  wordText: string;
  /** the letter unit as shown (letter > 0), else null */
  letterText: string | null;
}

const KINDS: TajweedKind[] = ["MAKHRAJ", "SIFA", "HUKM"];

/**
 * One detailed mistake, checked: a real word inside the range; a real
 * letter of it, or a gap whose next word is inside the range too (the gap
 * after the range's last word belongs to nothing recited); a code of its
 * kind on that target (a makhraj only one its letter can come from); and a
 * «قريبًا من حرف» letter on makhraj mistakes only.
 */
export function checkDetail(
  raw: unknown,
  surahNumber: number,
  fromAyah: number,
  toAyah: number,
): CheckedDetail | null {
  const d = raw as Partial<DetailInput> | null;
  if (!d || typeof d !== "object") return null;
  const ayah = d.ayah;
  const wordPosition = d.wordPosition;
  const letter = d.letter ?? 0;
  const gapAfter = d.gapAfter === true;
  const kind = d.kind as TajweedKind;
  const code = typeof d.code === "string" ? d.code : GENERAL;
  const confusedWith = d.confusedWith ?? null;
  if (!Number.isInteger(ayah) || ayah! < fromAyah || ayah! > toAyah || !Number.isInteger(wordPosition)) return null;
  if (!Number.isInteger(letter) || !isValidSpot({ letter, gapAfter }) || (letter === 0 && !gapAfter)) return null;
  if (!KINDS.includes(kind)) return null;
  const wordText = wordAt(surahNumber, ayah!, wordPosition!);
  if (!wordText) return null;

  const target: SpotTarget = gapAfter ? "GAP" : "LETTER";
  if (!isCodeFor(kind, target, code)) return null;

  let letterText: string | null = null;
  if (gapAfter) {
    const next = wordAfter(surahNumber, ayah!, wordPosition!);
    if (!next || next.ayah > toAyah) return null;
  } else {
    const units = splitLetters(wordText);
    const unit = units[letter - 1];
    if (!unit) return null;
    letterText = unit.text;
    if (kind === "MAKHRAJ" && code !== GENERAL && !makharijFor(unit, units[letter - 2]).includes(code as never)) return null;
  }
  if (confusedWith !== null && (kind !== "MAKHRAJ" || !isConfusionLetter(confusedWith))) return null;

  return { ayah: ayah!, wordPosition: wordPosition!, letter, gapAfter, kind, code, confusedWith, letterText, wordText };
}

/**
 * The detailed mistakes of one session, checked and combined per spot as
 * the form combines them (spots.ts addDetail: one per kind + code, a
 * specific code replacing its kind's general one).
 */
export function validateDetails(
  raw: unknown,
  surahNumber: number,
  fromAyah: number,
  toAyah: number,
): { error: string } | { details: CheckedDetail[] } {
  const list = Array.isArray(raw) ? raw : [];
  if (list.length > MAX_DETAILS_PER_SESSION) return { error: "عدد أخطاء التجويد المحدّدة كبير جدًا" };
  const bySpot = new Map<string, { base: CheckedDetail; errors: DetailError[] }>();
  for (const item of list) {
    const d = checkDetail(item, surahNumber, fromAyah, toAyah);
    if (!d) return { error: "بيانات أخطاء التجويد المفصّلة غير صحيحة" };
    const key = spotKey(surahNumber, d.ayah, d.wordPosition, d);
    const spot = bySpot.get(key) ?? { base: d, errors: [] };
    spot.errors = addDetail(spot.errors, { kind: d.kind, code: d.code, confusedWith: d.confusedWith });
    bySpot.set(key, spot);
  }
  return {
    details: [...bySpot.values()].flatMap(({ base, errors }) => errors.map((e) => ({ ...base, ...e }))),
  };
}
