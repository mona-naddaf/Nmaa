// Matching keys for the resource bank: tag identity and diacritic-insensitive
// search. Ignores tashkeel, tatweel, invisible marks and extra spaces, and
// treats أ/إ/آ/ٱ as ا and ة as ه — so «المولد النبويّ» and «المولد النبوي»
// are one tag, and «الاسراء» finds «الإسراء». Latin text is lowercased.

const IGNORED = /[ً-ٰٟـ​-‏؜⁦-⁩﻿]/g;

export function normalizeArabic(text: string): string {
  return text
    .normalize("NFC")
    .replace(IGNORED, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ة/g, "ه")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export const tagKey = normalizeArabic;

/** Display form of a typed tag: surrounding/repeated spaces removed, spelling kept. */
export function cleanTagName(text: string): string {
  return text.normalize("NFC").replace(/\s+/g, " ").trim();
}

/** "وسيلة واحدة" / "وسيلتان" / "3 وسائل" / "11 وسيلة" — Arabic counted-noun agreement. */
export function resourcesCount(n: number): string {
  if (n === 1) return "وسيلة واحدة";
  if (n === 2) return "وسيلتان";
  const r = n % 100;
  if (r >= 3 && r <= 10) return `${n} وسائل`;
  return `${n} وسيلة`;
}

export function resourceSearchKey(title: string, description: string | null): string {
  return normalizeArabic(`${title} ${description ?? ""}`);
}
