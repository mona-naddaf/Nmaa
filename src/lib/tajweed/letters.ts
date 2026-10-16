// Splits one word of the bundled Tanzil Uthmani text (as split by
// src/lib/quran-data/words.ts) into letter units, for detailed tajweed
// errors («أخطاء التجويد المفصّلة»). Pure and client-safe.
//
// A letter unit is one base character followed by every combining mark
// after it (harakat, shadda, sukun, ٰ ٓ ٔ, the small high/low signs ۜ ۣ ۢ ۭ ۟ ۠
// ۪ ۫ ۬ ...). Every non-mark character is a base, so:
//  - ٱ, ء, ۥ (small waw) and ۦ (small yaa) are units of their own;
//  - tatweel carrying a mark is its own unit and stands for the letter it
//    carries: ـٰ alif, ـٔ hamza, ـۧ yaa, ـۨ noon (ٱلرَّحْمَـٰنِ, ٱلْـَٔاخِرَةِ);
//  - ٰ written straight on a letter stays with it (ذَٰ in ذَٰلِكَ);
//  - a bare tatweel (none in the text today) joins the unit before it.
// A unit's index is 1-based and is what an error stores (`letter`); the
// units joined back give the word exactly.

export interface LetterUnit {
  /** 1-based position among the word's units */
  index: number;
  /** the unit as written: base + its marks */
  text: string;
  base: string;
  marks: string;
  /**
   * The letter it stands for, normalized for makhraj/sifat lookups: hamza
   * forms → ء, ٱ → ا, ة → ة, ى → ى, ۥ → و, ۦ → ي, tatweel → the letter
   * its mark stands for.
   */
  letter: string;
}

const MARK = /\p{M}/u;
const TATWEEL = "ـ";

// a tatweel's mark → the letter it stands for
const CARRIED: Record<string, string> = {
  "ٰ": "ا",
  "ٔ": "ء",
  "ٕ": "ء",
  "ۧ": "ي",
  "ۨ": "ن",
};

const NORMAL: Record<string, string> = {
  "أ": "ء",
  "إ": "ء",
  "ؤ": "ء",
  "ئ": "ء",
  "آ": "ا",
  "ٱ": "ا",
  "ۥ": "و",
  "ۦ": "ي",
};

function letterOf(base: string, marks: string): string {
  if (base === TATWEEL) {
    for (const m of marks) if (CARRIED[m]) return CARRIED[m];
    return TATWEEL;
  }
  return NORMAL[base] ?? base;
}

export function splitLetters(word: string): LetterUnit[] {
  const parts: { base: string; marks: string }[] = [];
  for (const ch of word) {
    const last = parts[parts.length - 1];
    if (MARK.test(ch)) {
      if (last) last.marks += ch;
      else parts.push({ base: "", marks: ch }); // never in the text; kept, not lost
    } else {
      parts.push({ base: ch, marks: "" });
    }
  }
  // a tatweel that carries nothing is only an extension of the unit before it
  const merged: { base: string; marks: string; text: string }[] = [];
  for (const p of parts) {
    const last = merged[merged.length - 1];
    if (p.base === TATWEEL && !p.marks && last) last.text += p.base;
    else merged.push({ ...p, text: p.base + p.marks });
  }
  return merged.map((p, i) => ({ index: i + 1, text: p.text, base: p.base, marks: p.marks, letter: letterOf(p.base, p.marks) }));
}

/** The unit at a 1-based index, or null. */
export function letterAt(word: string, index: number): LetterUnit | null {
  if (!Number.isInteger(index) || index < 1) return null;
  return splitLetters(word)[index - 1] ?? null;
}

// ---------- marks ----------

export const FATHA = "َ";
export const DAMMA = "ُ";
export const KASRA = "ِ";
export const SUKUN = "ْ";
export const SHADDA = "ّ";
export const TANWEEN_FATH = "ً";
export const TANWEEN_DAMM = "ٌ";
export const TANWEEN_KASR = "ٍ";
/** ٓ maddah: a long madd (المتصل/المنفصل/اللازم) */
export const MADDAH = "ٓ";
export const DAGGER_ALIF = "ٰ";
/** ۟ small high rounded zero: a letter written but never read */
export const SILENT = "۟";
/** ۢ / ۭ small meem: iqlab */
export const IQLAB_MEEMS = ["ۢ", "ۭ"];

const TANWEENS = [TANWEEN_FATH, TANWEEN_DAMM, TANWEEN_KASR];
const HARAKAT = [FATHA, DAMMA, KASRA];

export const hasSukun = (u: LetterUnit) => u.marks.includes(SUKUN);
export const hasShadda = (u: LetterUnit) => u.marks.includes(SHADDA);
export const hasTanween = (u: LetterUnit) => TANWEENS.some((t) => u.marks.includes(t));
export const hasHaraka = (u: LetterUnit) => HARAKAT.some((h) => u.marks.includes(h)) || hasTanween(u);
export const isSilent = (u: LetterUnit) => u.marks.includes(SILENT) || u.marks.includes("۠");

/**
 * A madd letter: ا (and ـٰ / ٰ-carrying ى), ۥ ۦ ـۧ, and a bare و / ي after
 * a damma / kasra. Read from the unit and the one before it only.
 */
export function isMaddLetter(u: LetterUnit, before: LetterUnit | undefined): boolean {
  if (isSilent(u)) return false;
  if (u.base === "ۥ" || u.base === "ۦ") return true;
  if (u.base === TATWEEL) return u.letter === "ا" || u.letter === "ي";
  if (u.letter === "ا" && u.base !== "ٱ" && u.base !== "ء") return !hasHaraka(u) && !hasSukun(u);
  if (u.base === "ى") return !hasHaraka(u) && !hasSukun(u) && !hasShadda(u);
  if (u.base !== "و" && u.base !== "ي") return false;
  if (hasHaraka(u) || hasSukun(u) || hasShadda(u)) return false;
  return !!before && before.marks.includes(u.base === "و" ? DAMMA : KASRA);
}

/** Whether the unit carries a long-madd sign (ٓ, or a precomposed آ). */
export const hasMaddah = (u: LetterUnit) => u.marks.includes(MADDAH) || u.base === "آ";

// ---------- display: keeping joined shapes when the units are shown apart ----------

const ZWJ = "‍";

// letters that join on both sides; everything else joins only to the one
// before it (ا د ذ ر ز و ة ...) or not at all (ء ۥ ۦ)
const DUAL = new Set([..."بتثجحخسشصضطظعغفقكلمنهيئىـ"]);
const NONE = new Set([..."ءۥۦ"]);

const joinsBefore = (u: LetterUnit) => !!u.base && !NONE.has(u.base);
const joinsAfter = (u: LetterUnit) => DUAL.has(u.base);

/**
 * Each unit's text for showing the units apart (one tap target each)
 * while keeping the shapes they have inside the word: a zero-width joiner
 * on each side where the letter is joined to its neighbour.
 */
export function displayUnits(units: LetterUnit[]): string[] {
  return units.map((u, i) => {
    const prev = units[i - 1];
    const next = units[i + 1];
    const lead = prev && joinsAfter(prev) && joinsBefore(u) ? ZWJ : "";
    const tail = next && joinsAfter(u) && joinsBefore(next) ? ZWJ : "";
    return lead + u.text + tail;
  });
}
