// «التظليل»: the pure rules, shared by the browser (to answer at once) and
// the server (which decides). A highlight is a stretch of words of one surah,
// stored by words.ts positions: at most 3 ayat, on one Mushaf page (in the
// Madinah Mushaf no ayah crosses a page, so: every ayah of it on the same
// page), never overlapping another of the same owner. A boundary inside a
// glyph that stands for two words (37:130 «إِلْ يَاسِينَ») widens to the whole
// glyph, in both views, so both show the same stretch.

import { DEFAULT_HIGHLIGHT_COLOR, isHighlightColor, type HighlightColor } from "./colors";

export const MAX_HIGHLIGHT_AYAT = 3;
export const MAX_HIGHLIGHTS = 1000;
export const MAX_HIGHLIGHT_COLORS = 5;
export const MAX_COLOR_NAME = 30;

/** One word: its ayah and its position in the ayah (words.ts). */
export type WordRef = { ayah: number; word: number };

export type HighlightRange = { surahNumber: number; fromAyah: number; fromWord: number; toAyah: number; toWord: number };

/** A highlight as a page gets it: byName = the adult who made it on a child's page (null: unknown / «أحد البالغين»). */
export type HighlightRow = HighlightRange & { id: string; color: HighlightColor; byAdult: boolean; byName: string | null };

/** Where one glyph stands for two of our words: "s:a:w" = words w and w+1 (the Mushaf data, page.ts). */
export const TWO_WORD_GLYPHS = ["37:130:3"] as const;

const cmp = (a: WordRef, b: WordRef) => a.ayah - b.ayah || a.word - b.word;

/** The two tapped words as a range, in reading order (either may be tapped first). */
export function rangeOf(surahNumber: number, a: WordRef, b: WordRef): HighlightRange {
  const [first, last] = cmp(a, b) <= 0 ? [a, b] : [b, a];
  return { surahNumber, fromAyah: first.ayah, fromWord: first.word, toAyah: last.ayah, toWord: last.word };
}

/** A range whose ends sit inside a two-word glyph, widened to the whole glyph. */
export function snapToGlyphs(r: HighlightRange): HighlightRange {
  let { fromWord, toWord } = r;
  for (const g of TWO_WORD_GLYPHS) {
    const [s, a, w] = g.split(":").map(Number);
    if (s !== r.surahNumber) continue;
    if (r.fromAyah === a && fromWord === w + 1) fromWord = w;
    if (r.toAyah === a && toWord === w) toWord = w + 1;
  }
  return { ...r, fromWord, toWord };
}

export type RangeProblem = "invalid" | "ayat" | "page" | "overlap" | "cap";

/** What the rules need to know about the Quran: an ayah's word count (0: no such ayah) and its Mushaf page. */
export type QuranFacts = { wordCount: (surah: number, ayah: number) => number; pageOf: (surah: number, ayah: number) => number | null };

/** Why a range can't be a highlight, or null. existing: the owner's other highlights in this surah. */
export function rangeProblem(r: HighlightRange, facts: QuranFacts, existing: HighlightRange[], total = 0): RangeProblem | null {
  const ints = [r.surahNumber, r.fromAyah, r.fromWord, r.toAyah, r.toWord].every((n) => Number.isInteger(n) && n >= 1);
  if (!ints || r.surahNumber > 114) return "invalid";
  const fromCount = facts.wordCount(r.surahNumber, r.fromAyah);
  const toCount = facts.wordCount(r.surahNumber, r.toAyah);
  if (fromCount === 0 || toCount === 0 || r.fromWord > fromCount || r.toWord > toCount) return "invalid";
  if (cmp({ ayah: r.fromAyah, word: r.fromWord }, { ayah: r.toAyah, word: r.toWord }) > 0) return "invalid";
  if (r.toAyah - r.fromAyah + 1 > MAX_HIGHLIGHT_AYAT) return "ayat";
  const page = facts.pageOf(r.surahNumber, r.fromAyah);
  for (let a = r.fromAyah; a <= r.toAyah; a++) if (facts.pageOf(r.surahNumber, a) !== page) return "page";
  if (existing.some((h) => overlaps(h, r))) return "overlap";
  if (total >= MAX_HIGHLIGHTS) return "cap";
  return null;
}

/** Two ranges share at least one word. */
export function overlaps(a: HighlightRange, b: HighlightRange): boolean {
  if (a.surahNumber !== b.surahNumber) return false;
  const aFrom = { ayah: a.fromAyah, word: a.fromWord };
  const aTo = { ayah: a.toAyah, word: a.toWord };
  const bFrom = { ayah: b.fromAyah, word: b.fromWord };
  const bTo = { ayah: b.toAyah, word: b.toWord };
  return cmp(aFrom, bTo) <= 0 && cmp(bFrom, aTo) <= 0;
}

/** The range covers this word. */
export function covers(r: HighlightRange, surah: number, ayah: number, word: number): boolean {
  if (r.surahNumber !== surah) return false;
  const w = { ayah, word };
  return cmp({ ayah: r.fromAyah, word: r.fromWord }, w) <= 0 && cmp(w, { ayah: r.toAyah, word: r.toWord }) <= 0;
}

// ---- colours ----

export type PaletteEntry = { color: HighlightColor; name: string | null };

/** Her colours: the default first (always there, even with no rows), then the ones she added, in order. */
export function paletteOf(rows: { color: string; name: string | null; sortOrder: number }[]): PaletteEntry[] {
  const valid = rows.filter((r) => isHighlightColor(r.color)) as { color: HighlightColor; name: string | null; sortOrder: number }[];
  const def = valid.find((r) => r.color === DEFAULT_HIGHLIGHT_COLOR);
  const rest = valid.filter((r) => r.color !== DEFAULT_HIGHLIGHT_COLOR).sort((a, b) => a.sortOrder - b.sortOrder);
  return [{ color: DEFAULT_HIGHLIGHT_COLOR, name: def?.name ?? null }, ...rest.map((r) => ({ color: r.color, name: r.name }))];
}

/** A colour name as saved: trimmed, spaces collapsed; empty = no name; null when too long. */
export function cleanColorName(raw: unknown): { name: string | null } | null {
  if (raw === null || raw === undefined) return { name: null };
  if (typeof raw !== "string") return null;
  const name = raw.replace(/\s+/g, " ").trim();
  if (name.length > MAX_COLOR_NAME) return null;
  return { name: name || null };
}

// ---- who may change what ----

export type HighlightViewer = "self" | "child" | "adult-edit" | "adult-view";

/**
 * What the viewer may do with a highlight on the page she is looking at:
 * her own page, everything; a child, only what she made herself (an adult's
 * shows 🔒); an adult with edit rights on a child's page, any of the child's;
 * a view-only adult, nothing.
 */
export function canChange(viewer: HighlightViewer, h: { byAdult: boolean }): boolean {
  if (viewer === "self" || viewer === "adult-edit") return true;
  if (viewer === "child") return !h.byAdult;
  return false;
}

/** Highlighting at all (the «تظليل» button). */
export const canHighlight = (viewer: HighlightViewer) => viewer !== "adult-view";
