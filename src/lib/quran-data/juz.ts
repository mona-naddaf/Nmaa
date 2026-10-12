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

// ---------- whole-surah grouping for «ترتيب المصحف بالعكس» ----------

/**
 * The surahs each juz owns as whole surahs, for a plan that works in juz
 * (the reverse plan's direction per juz): [first, last] surah, or null when
 * no surah belongs to it. A surah that crosses a juz boundary belongs to the
 * juz holding more of its pages; on a tie, to the juz where it ends (e.g.
 * Adh-Dhariyat → 27, Al-Anfal → 10). Index 0 = juz 1. Fixed rather than
 * computed: summed page fractions tie only up to rounding (Al-Baqarah,
 * Al-Anfal), and this grouping was agreed table by table.
 */
export const JUZ_SURAH_GROUPS: ([number, number] | null)[] = [
  [1, 1],
  [2, 2],
  null,
  [3, 3],
  [4, 4],
  [5, 5],
  [6, 6],
  null,
  [7, 7],
  [8, 9],
  [10, 10],
  [11, 11],
  [12, 14],
  [15, 16],
  [17, 18],
  [19, 20],
  [21, 22],
  [23, 24],
  [25, 27],
  [28, 29],
  [30, 32],
  [33, 35],
  [36, 38],
  [39, 41],
  [42, 45],
  [46, 50],
  [51, 57],
  [58, 66],
  [67, 77],
  [78, 114],
];

/** The surahs (ascending) a juz owns in the grouping above. */
export function juzGroupSurahs(juz: number): number[] {
  const g = JUZ_SURAH_GROUPS[juz - 1];
  if (!g) return [];
  return Array.from({ length: g[1] - g[0] + 1 }, (_, i) => g[0] + i);
}

/** The juz a surah belongs to in the grouping above. */
export function groupJuzOfSurah(surahNumber: number): number | null {
  const i = JUZ_SURAH_GROUPS.findIndex((g) => g && surahNumber >= g[0] && surahNumber <= g[1]);
  return i === -1 ? null : i + 1;
}
