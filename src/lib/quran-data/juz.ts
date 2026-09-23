import { AYAH_COUNT, getAyahPageEntries } from "./index";

export interface AyahRef {
  surahNumber: number;
  ayah: number;
}

// First ayah of each juz (index 0 = juz 1), per the standard Madani mushaf.
// surahs.json only records the juz a surah *starts* in, but juz boundaries
// fall mid-surah, so this table is the source of truth for juz membership.
export const JUZ_STARTS: AyahRef[] = [
  { surahNumber: 1, ayah: 1 },
  { surahNumber: 2, ayah: 142 },
  { surahNumber: 2, ayah: 253 },
  { surahNumber: 3, ayah: 93 },
  { surahNumber: 4, ayah: 24 },
  { surahNumber: 4, ayah: 148 },
  { surahNumber: 5, ayah: 82 },
  { surahNumber: 6, ayah: 111 },
  { surahNumber: 7, ayah: 88 },
  { surahNumber: 8, ayah: 41 },
  { surahNumber: 9, ayah: 93 },
  { surahNumber: 11, ayah: 6 },
  { surahNumber: 12, ayah: 53 },
  { surahNumber: 15, ayah: 1 },
  { surahNumber: 17, ayah: 1 },
  { surahNumber: 18, ayah: 75 },
  { surahNumber: 21, ayah: 1 },
  { surahNumber: 23, ayah: 1 },
  { surahNumber: 25, ayah: 21 },
  { surahNumber: 27, ayah: 56 },
  { surahNumber: 29, ayah: 46 },
  { surahNumber: 33, ayah: 31 },
  { surahNumber: 36, ayah: 28 },
  { surahNumber: 39, ayah: 32 },
  { surahNumber: 41, ayah: 47 },
  { surahNumber: 46, ayah: 1 },
  { surahNumber: 51, ayah: 31 },
  { surahNumber: 58, ayah: 1 },
  { surahNumber: 67, ayah: 1 },
  { surahNumber: 78, ayah: 1 },
];

function compareRef(a: AyahRef, b: AyahRef): number {
  return a.surahNumber - b.surahNumber || a.ayah - b.ayah;
}

/** The juz (1–30) containing an ayah, or null for an invalid reference. */
export function juzOf(surahNumber: number, ayah: number): number | null {
  const count = AYAH_COUNT[surahNumber];
  if (!count || ayah < 1 || ayah > count) return null;
  const ref = { surahNumber, ayah };
  for (let j = JUZ_STARTS.length - 1; j >= 0; j--) {
    if (compareRef(JUZ_STARTS[j], ref) <= 0) return j + 1;
  }
  return null;
}

/**
 * Every surah's ayah range that falls inside a juz, in Mushaf order —
 * e.g. juz 2 → [{2, 142–252}].
 */
export function juzSegments(juz: number): { surahNumber: number; fromAyah: number; toAyah: number }[] {
  const start = JUZ_STARTS[juz - 1];
  if (!start) return [];
  const next = JUZ_STARTS[juz]; // undefined for juz 30 → runs to the end of the Quran

  const segments: { surahNumber: number; fromAyah: number; toAyah: number }[] = [];
  const lastSurah = next ? (next.ayah === 1 ? next.surahNumber - 1 : next.surahNumber) : 114;
  for (let s = start.surahNumber; s <= lastSurah; s++) {
    const fromAyah = s === start.surahNumber ? start.ayah : 1;
    const toAyah = next && s === next.surahNumber ? next.ayah - 1 : AYAH_COUNT[s];
    segments.push({ surahNumber: s, fromAyah, toAyah });
  }
  return segments;
}

/** Total page-fraction span of a juz, summed from the per-ayah page data. */
export function juzTotalPages(juz: number): number {
  let total = 0;
  for (const seg of juzSegments(juz)) {
    const entries = getAyahPageEntries(seg.surahNumber);
    if (!entries) continue;
    for (let a = seg.fromAyah; a <= seg.toAyah; a++) total += entries[a - 1][0];
  }
  return total;
}
