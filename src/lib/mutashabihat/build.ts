// «المتشابهات»: turning QUL's (Tarteel) Mutashabihat ul Quran phrases into
// the per-verse index the app ships (src/lib/quran-data/mutashabihat.json).
// Pure, so scripts/build-mutashabihat.ts and the tests share it.
//
// QUL gives, per phrase, the 1-based word range it covers in each verse
// («2:23» → [[15, 17]]), counted the way our Tanzil text is split into
// words (src/lib/quran-data/words.ts). Each range is checked against our
// text and dropped when it can't be right: outside the verse, or misaligned
// (shifted by one word it would match the source phrase better). Near-
// variants (different wording at the same place) are kept on purpose:
// they're the confusable pairs.

export type Range = [from: number, to: number];

export interface RawPhrase {
  surahs: number;
  ayahs: number;
  /** occurrences across the Quran (QUL's count) */
  count: number;
  /** the verse and range the phrase is taken from */
  source: { key: string; from: number; to: number };
  /** verse key → the ranges it covers there (a verse can hold it twice) */
  ayah: Record<string, Range[]>;
}

/** What the app ships: per verse, its phrases and ranges; per phrase, its verses. */
export interface MutashabihatIndex {
  /** phrase id → its verse keys, in mushaf order */
  phrases: Record<string, string[]>;
  /** verse key → [phraseId, from, to] per occurrence */
  verses: Record<string, [number, number, number][]>;
}

export interface BuildOptions {
  minWords: number;
  maxCount: number;
}

export const DEFAULT_OPTIONS: BuildOptions = { minWords: 3, maxCount: 10 };

/** A word reduced to its letters, for comparing: no harakat or Quranic marks; alef and ya forms unified. */
export function normalizeWord(w: string): string {
  return w
    .normalize("NFC")
    .replace(/[ً-ٰٟۖ-ۭـ]/g, "")
    .replace(/[ٱأإآ]/g, "ا")
    .replace(/ى/g, "ي");
}

/**
 * How many of the source's words a stretch keeps, in order (longest common
 * subsequence): variants may add, drop or swap a word and still score high.
 */
export function sharedInOrder(a: string[], b: string[]): number {
  let prev = new Array<number>(b.length + 1).fill(0);
  for (const x of a) {
    const row = [0];
    for (let j = 0; j < b.length; j++) row.push(x === b[j] ? prev[j] + 1 : Math.max(prev[j + 1], row[j]));
    prev = row;
  }
  return prev[b.length];
}

const slice = (words: string[], [from, to]: Range) => words.slice(from - 1, to);
const inBounds = (words: string[], [from, to]: Range) => from >= 1 && to >= from && to <= words.length;

/**
 * One occurrence against the source phrase (both as normalized words).
 * "misaligned": as long as the source, and moved one word either way it
 * keeps more of the source's words in order — off by one, not a variant.
 * A range of another length is a variant (a word added, dropped or swapped)
 * and only checked for bounds: shifting it would just reach for the words
 * the variant doesn't have.
 */
export function checkOccurrence(words: string[], range: Range, source: string[]): "ok" | "out-of-range" | "misaligned" {
  if (!inBounds(words, range)) return "out-of-range";
  if (range[1] - range[0] + 1 !== source.length) return "ok";
  const here = sharedInOrder(slice(words, range), source);
  for (const d of [-1, 1]) {
    const shifted: Range = [range[0] + d, range[1] + d];
    if (inBounds(words, shifted) && sharedInOrder(slice(words, shifted), source) > here) return "misaligned";
  }
  return "ok";
}

export const parseKey = (key: string): [number, number] => {
  const [s, a] = key.split(":").map(Number);
  return [s, a];
};

export const compareKeys = (a: string, b: string) => {
  const [sa, aa] = parseKey(a);
  const [sb, ab] = parseKey(b);
  return sa - sb || aa - ab;
};

export interface BuildLog {
  phrasesIn: number;
  occurrencesIn: number;
  outOfRange: number;
  misaligned: number;
  /** source range itself invalid: the whole phrase is dropped */
  badSource: number;
  /** fewer than options.minWords words */
  tooShort: number;
  /** more than options.maxCount occurrences */
  tooCommon: number;
  /** left with fewer than two verses after the checks */
  tooFewVerses: number;
  phrasesOut: number;
  versesOut: number;
}

/**
 * wordsOf: a verse's words (normalized), or null for an unknown key.
 * Checks every range, then keeps phrases of at least minWords words seen at
 * most maxCount times in at least two verses.
 */
export function buildIndex(
  raw: Record<string, RawPhrase>,
  wordsOf: (key: string) => string[] | null,
  options: BuildOptions = DEFAULT_OPTIONS,
): { index: MutashabihatIndex; log: BuildLog } {
  const log: BuildLog = {
    phrasesIn: 0,
    occurrencesIn: 0,
    outOfRange: 0,
    misaligned: 0,
    badSource: 0,
    tooShort: 0,
    tooCommon: 0,
    tooFewVerses: 0,
    phrasesOut: 0,
    versesOut: 0,
  };
  const phrases: MutashabihatIndex["phrases"] = {};
  const verses: MutashabihatIndex["verses"] = {};

  for (const [id, p] of Object.entries(raw)) {
    log.phrasesIn++;
    for (const rs of Object.values(p.ayah)) log.occurrencesIn += rs.length;

    const sourceWords = wordsOf(p.source.key);
    const sourceRange: Range = [p.source.from, p.source.to];
    if (!sourceWords || !inBounds(sourceWords, sourceRange)) {
      log.badSource++;
      continue;
    }
    const source = slice(sourceWords, sourceRange);

    // every range checked, whatever the filters decide
    const kept: [string, Range[]][] = [];
    for (const [key, ranges] of Object.entries(p.ayah)) {
      const words = wordsOf(key);
      const good: Range[] = [];
      for (const r of ranges) {
        const result = words ? checkOccurrence(words, r, source) : "out-of-range";
        if (result === "out-of-range") log.outOfRange++;
        else if (result === "misaligned") log.misaligned++;
        else good.push([r[0], r[1]]);
      }
      if (good.length) kept.push([key, good]);
    }

    if (source.length < options.minWords) {
      log.tooShort++;
      continue;
    }
    if (p.count > options.maxCount) {
      log.tooCommon++;
      continue;
    }
    if (kept.length < 2) {
      log.tooFewVerses++;
      continue;
    }

    kept.sort(([a], [b]) => compareKeys(a, b));
    phrases[id] = kept.map(([k]) => k);
    for (const [key, ranges] of kept) for (const [from, to] of ranges) (verses[key] ??= []).push([Number(id), from, to]);
  }

  for (const list of Object.values(verses)) list.sort((a, b) => a[1] - b[1] || a[0] - b[0]);
  log.phrasesOut = Object.keys(phrases).length;
  log.versesOut = Object.keys(verses).length;
  return { index: { phrases, verses }, log };
}
