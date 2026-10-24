import type { PersonGender } from "@/lib/text/gender";

// The help texts are written as on the review page: [f|m] is a word in its
// feminine and masculine forms («لتختار[ي|]» has an empty masculine ending).
// A possessive the page wrote only in the feminine («خطتكِ»، «جدولكِ») takes
// its masculine form too (Mona, 2026-10-24, the same rule as the setup
// questions): a «كِ» outside the brackets becomes «ك». Pure.

const PAIR = /\[([^[\]|]*)\|([^[\]|]*)\]/g;
const FEMININE_KAF = /كِ/g;

/** The text in her gender (a man's, or no gender given: masculine). */
export function genderText(text: string, gender: PersonGender): string {
  if (gender === "FEMALE") return text.replace(PAIR, (_, f: string) => f);
  // every «كِ» left is a feminine «you» ending outside a pair
  return text.replace(PAIR, (_, _f: string, m: string) => m).replace(FEMININE_KAF, "ك");
}

/** True when every bracket in the text is a well-formed [f|m] pair. */
export function pairsAreWellFormed(text: string): boolean {
  return !/[[\]|]/.test(text.replace(PAIR, ""));
}
