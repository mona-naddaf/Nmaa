// «+ ملاحظة على آية»: finding a surah by what she types. Pure.
//
// Tolerant of the word «سورة» before the name, of tashkeel, of hamza forms
// (أ إ آ ٱ ء ؤ ئ), of ة / ه and ى / ي, and of a missing «ال». A number finds
// the surah of that number.

import { SURAHS, type Surah } from "@/lib/quran-data";
import { normalizeArabic } from "@/lib/resources/normalize";

export function surahKey(text: string): string {
  return normalizeArabic(text)
    .replace(/ى/g, "ي")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/ء/g, "")
    .replace(/^سوره\s*/, "")
    .trim();
}

const withoutAl = (k: string) => k.replace(/^ال/, "");

const KEYS = SURAHS.map((s) => ({ s, key: surahKey(s.name), bare: withoutAl(surahKey(s.name)) }));

/** The surahs matching what she typed, best first: the same name, then names starting with it, then containing it. */
export function findSurahs(query: string, limit = 6): Surah[] {
  const digits = query.trim().replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660));
  if (/^\d+$/.test(digits)) {
    const n = Number(digits);
    return KEYS.filter((k) => k.s.number === n).map((k) => k.s);
  }
  const q = surahKey(query);
  if (!q) return [];
  const bare = withoutAl(q);
  const rank = (k: (typeof KEYS)[number]) =>
    k.key === q || k.bare === bare ? 0 : k.key.startsWith(q) || k.bare.startsWith(bare) ? 1 : k.key.includes(bare) ? 2 : -1;
  return KEYS.map((k) => ({ k, r: rank(k) }))
    .filter((x) => x.r >= 0)
    .sort((a, b) => a.r - b.r || a.k.s.number - b.k.s.number)
    .slice(0, limit)
    .map((x) => x.k.s);
}

/** The one surah she means, when the name is complete (or a number); else null. */
export function exactSurah(query: string): Surah | null {
  const found = findSurahs(query, 2);
  if (found.length === 0) return null;
  const q = withoutAl(surahKey(query));
  const first = found[0];
  return /^[\d٠-٩]+$/.test(query.trim()) || withoutAl(surahKey(first.name)) === q ? first : null;
}

/** «7 آيات» / «110 آيات» / «286 آية»: a surah's verse count, with the noun agreeing. */
export function ayatCount(n: number): string {
  if (n === 1) return "آية واحدة";
  if (n === 2) return "آيتان";
  const r = n % 100;
  return r >= 3 && r <= 10 ? `${n} آيات` : `${n} آية`;
}
