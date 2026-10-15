// «المتشابهات»: reading the shipped index (built by build.ts). Pure, so it's
// tested on a small index; data.ts binds it to the real file, server-side.

import { compareKeys, type MutashabihatIndex, type Range } from "./build";

/** One phrase of a verse: where it is in this verse, and the other verses that have it. */
export interface SimilarGroup {
  phraseId: number;
  /** this verse's ranges for the phrase (usually one) */
  own: Range[];
  /** the other verses, in mushaf order, each with its own ranges */
  others: { key: string; ranges: Range[] }[];
}

const rangesOf = (index: MutashabihatIndex, key: string, phraseId: number): Range[] =>
  (index.verses[key] ?? []).filter(([id]) => id === phraseId).map(([, from, to]) => [from, to]);

/** A verse's phrases, ordered by where they start in it; [] when it has none. */
export function groupsForVerse(index: MutashabihatIndex, key: string): SimilarGroup[] {
  const entries = index.verses[key];
  if (!entries) return [];
  const ids = [...new Set(entries.map(([id]) => id))];
  return ids
    .map((id) => ({
      phraseId: id,
      own: rangesOf(index, key, id),
      others: (index.phrases[String(id)] ?? []).filter((k) => k !== key).map((k) => ({ key: k, ranges: rangesOf(index, k, id) })),
    }))
    .filter((g) => g.others.length > 0)
    .sort((a, b) => a.own[0][0] - b.own[0][0] || a.phraseId - b.phraseId);
}

/** Every marked verse of a surah: ayah number → its groups. */
export function groupsForSurah(index: MutashabihatIndex, surah: number): Record<number, SimilarGroup[]> {
  const out: Record<number, SimilarGroup[]> = {};
  const prefix = `${surah}:`;
  for (const key of Object.keys(index.verses)) {
    if (!key.startsWith(prefix)) continue;
    const groups = groupsForVerse(index, key);
    if (groups.length) out[Number(key.slice(prefix.length))] = groups;
  }
  return out;
}

/** The distinct other verses a verse is similar to, in mushaf order. */
export function partnersOf(index: MutashabihatIndex, key: string): string[] {
  return [...new Set(groupsForVerse(index, key).flatMap((g) => g.others.map((o) => o.key)))].sort(compareKeys);
}

/** A verse that is part of some phrase (the only verses the popup may ask text for). */
export const isIndexed = (index: MutashabihatIndex, key: string) => Object.hasOwn(index.verses, key);
