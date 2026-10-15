import "server-only";
import data from "@/lib/quran-data/mutashabihat.json";
import { surahText } from "@/lib/quran-data/quran-text";
import type { MutashabihatIndex } from "./build";
import { groupsForSurah, groupsForVerse, isIndexed, type SimilarGroup } from "./lookup";

// «المتشابهات», server-side: the shipped index (scripts/build-mutashabihat.ts)
// never reaches a client bundle. Each area's server actions check that the
// viewer may see the marks, then call these.

const INDEX = data as unknown as MutashabihatIndex;

/** The most verse texts one request may ask for. */
export const MAX_VERSE_KEYS = 20;

/** A surah's marked verses: ayah number → its groups (no text). */
export function similarForSurah(surah: unknown): Record<number, SimilarGroup[]> | null {
  const n = Number(surah);
  if (!Number.isInteger(n) || n < 1 || n > 114) return null;
  return groupsForSurah(INDEX, n);
}

/** One verse's groups (no text). */
export function similarForVerse(surah: number, ayah: number): SimilarGroup[] {
  return groupsForVerse(INDEX, `${surah}:${ayah}`);
}

/**
 * The text of verses the popup shows: only verses in the index (every verse
 * with a mark or a partner), at most MAX_VERSE_KEYS; anything else is refused.
 */
export function similarVerseTexts(keys: unknown): Record<string, string> | null {
  if (!Array.isArray(keys) || keys.length === 0 || keys.length > MAX_VERSE_KEYS) return null;
  const out: Record<string, string> = {};
  for (const key of keys) {
    if (typeof key !== "string" || !/^\d{1,3}:\d{1,3}$/.test(key) || !isIndexed(INDEX, key)) return null;
    const [s, a] = key.split(":").map(Number);
    const text = surahText(s)?.[a - 1];
    if (!text) return null;
    out[key] = text;
  }
  return out;
}

export type { SimilarGroup };
