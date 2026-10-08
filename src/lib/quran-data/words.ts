// Splits one ayah of the (verbatim) Tanzil Uthmani text into words for
// display and mistake flagging. Pure and client-safe: callers pass the text
// in — the full text lives server-side (quran-text.ts) and reaches the
// browser one surah at a time through /api/quran-text/[surah].
//
// A "word position" is the 1-based index among an ayah's words only:
//  - pause marks (ۖ ۗ ۚ …), the rub-el-hizb sign ۞ and the sajdah sign ۩ are
//    space-separated tokens in the text but not words; they're kept and
//    shown attached to the neighbouring word, never counted or tappable.
//  - Tanzil prefixes each surah's first ayah with the basmala (except
//    al-Fatiha, where the basmala IS ayah 1, and at-Tawba, which has none).
//    It isn't part of that ayah, so it's returned separately and the ayah's
//    words start after it.

export interface AyahWord {
  /** 1-based position among the ayah's words */
  position: number;
  text: string;
  /** pause/sajdah marks that follow this word, shown after it */
  marks: string;
}

export interface SplitAyah {
  basmala: string | null;
  /** marks before the first word (e.g. ۞ at the start of a hizb quarter) */
  leadingMarks: string;
  words: AyahWord[];
}

// Arabic letters (incl. alef wasla ٱ and the extended letters); a token with
// none of these is a mark, not a word
const LETTER = /[ء-يٮ-ٯٱ-ۓەۮ-ۯۺ-ۼۿ]/;
const BASMALA_WORDS = 4;

export function hasBasmalaPrefix(surahNumber: number, ayah: number): boolean {
  return ayah === 1 && surahNumber !== 1 && surahNumber !== 9;
}

/** The ayah's own text, without the basmala Tanzil prefixes to a first ayah. */
export function ayahOnly(surahNumber: number, ayah: number, text: string): string {
  if (!hasBasmalaPrefix(surahNumber, ayah)) return text;
  return text.split(" ").filter(Boolean).slice(BASMALA_WORDS).join(" ");
}

export function splitAyah(surahNumber: number, ayah: number, text: string): SplitAyah {
  let tokens = text.split(" ").filter(Boolean);
  let basmala: string | null = null;
  if (hasBasmalaPrefix(surahNumber, ayah)) {
    basmala = tokens.slice(0, BASMALA_WORDS).join(" ");
    tokens = tokens.slice(BASMALA_WORDS);
  }

  let leadingMarks = "";
  const words: AyahWord[] = [];
  for (const token of tokens) {
    if (LETTER.test(token)) {
      words.push({ position: words.length + 1, text: token, marks: "" });
    } else if (words.length > 0) {
      const last = words[words.length - 1];
      last.marks = last.marks ? `${last.marks} ${token}` : token;
    } else {
      leadingMarks = leadingMarks ? `${leadingMarks} ${token}` : token;
    }
  }
  return { basmala, leadingMarks, words };
}
