// The Madinah Mushaf page layout (KFGQPC V2, 1421H print, 604 pages) for
// «صفحة المصحف». Pure and client-safe: the page files live in
// public/mushaf/v2/p{n}.json (built by scripts/import-qcf-v2.mjs) and are
// fetched one page at a time; the glyphs are drawn with that page's QCF V2
// font (see font.ts).
//
// A word key "s:a:w" is exactly the word position of words.ts (splitAyah),
// so mistakes keep their keys in both views; the mapping is checked over the
// whole Quran by mapping.test.ts.

import { getAyahPageEntries } from "@/lib/quran-data";
import { juzOf } from "@/lib/quran-data/juz";

/** One line of a page. */
export type MushafLine =
  /** the surah-name line */
  | { t: "s"; s: number }
  /** the basmala line */
  | { t: "b"; s: number }
  /** a line of words; c: printed centred */
  | { t: "a"; c?: 1; w: MushafEntry[] };

/**
 * ["s:a:w" | "s:a:e", glyph] ("e": the ayah-end glyph). A third element 2:
 * one glyph for two of our words, w and w+1 (only «إِلْ يَاسِينَ» in 37:130);
 * it is tapped as word w.
 */
export type MushafEntry = [key: string, glyph: string, span?: 2];

export interface MushafPage {
  p: number;
  lines: MushafLine[];
}

export const MUSHAF_PAGES = 604;

/** The pages an ayah range of one surah touches, first to last (by the bundled page map). */
export function pagesOf(surah: number, fromAyah: number, toAyah: number): number[] {
  const entries = getAyahPageEntries(surah);
  const first = entries?.[fromAyah - 1];
  const last = entries?.[toAyah - 1];
  if (!first || !last) return [];
  const pages: number[] = [];
  for (let p = first[1]; p <= last[2]; p++) pages.push(p);
  return pages;
}

/** The page header: the surah the page opens with, and the juz of its first ayah. */
export function pageHeader(page: MushafPage): { surah: number; juz: number } {
  const first = page.lines[0];
  const words = page.lines.find((l) => l.t === "a");
  const ayah = words?.t === "a" ? parseKey(words.w[0][0]) : null;
  const surah = first.t === "a" ? parseKey(first.w[0][0]).surah : first.s;
  return { surah, juz: (ayah && juzOf(ayah.surah, ayah.ayah)) ?? 1 };
}

/** The word keys an entry stands for (none for the ayah-end glyph). */
export function entryWords([key, , span]: MushafEntry): string[] {
  const { surah, ayah, word } = parseKey(key);
  if (word === 0) return [];
  return span === 2 ? [key, `${surah}:${ayah}:${word + 1}`] : [key];
}

/** "s:a:w" / "s:a:e" → its parts; w = 0 for the ayah-end glyph. */
export function parseKey(key: string): { surah: number; ayah: number; word: number } {
  const [s, a, w] = key.split(":");
  return { surah: Number(s), ayah: Number(a), word: w === "e" ? 0 : Number(w) };
}

// one fetch per page per page load (the files themselves are cached by the browser)
const pageCache = new Map<number, Promise<MushafPage>>();

export function loadMushafPage(page: number): Promise<MushafPage> {
  let p = pageCache.get(page);
  if (!p) {
    p = fetch(`/mushaf/v2/p${page}.json`)
      .then((r) => (r.ok ? (r.json() as Promise<MushafPage>) : Promise.reject(new Error(String(r.status)))))
      .then((d) => (d.p === page && Array.isArray(d.lines) ? d : Promise.reject(new Error("bad page file"))));
    p.catch(() => pageCache.delete(page));
    pageCache.set(page, p);
  }
  return p;
}
