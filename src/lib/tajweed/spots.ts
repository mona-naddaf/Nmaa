// Where a detailed tajweed error sits, and how several errors on the same
// spot combine. Pure and client-safe.
//
// A spot is the whole word (letter 0, as every error before this feature),
// one letter unit of it (letter n, src/lib/tajweed/letters.ts), or the gap
// after it (gapAfter). Keys extend the word key of FlaggableAyah:
// "s:a:w" whole word, "s:a:w:L3" its 3rd letter, "s:a:w:G" the gap after it.
//
// On one spot, in one session (or open, for home marks), errors are unique
// by kind + code. The code GENERAL ("") stands for "this kind, no detail":
// a specific code of a kind replaces that kind's general entry, and a
// general entry is ignored once the kind has a specific one.

import { GENERAL, type TajweedKind } from "./taxonomy";

export interface Spot {
  /** 0 = the whole word or the gap; 1..n = a letter unit */
  letter: number;
  gapAfter: boolean;
}

export const WHOLE_WORD: Spot = { letter: 0, gapAfter: false };
export const GAP: Spot = { letter: 0, gapAfter: true };
export const letterSpot = (letter: number): Spot => ({ letter, gapAfter: false });

export function spotKey(surah: number, ayah: number, wordPosition: number, spot: Spot): string {
  const word = `${surah}:${ayah}:${wordPosition}`;
  if (spot.gapAfter) return `${word}:G`;
  return spot.letter > 0 ? `${word}:L${spot.letter}` : word;
}

export function parseSpotKey(key: string): { surah: number; ayah: number; wordPosition: number; spot: Spot } | null {
  const m = /^(\d+):(\d+):(\d+)(?::(G|L(\d+)))?$/.exec(key);
  if (!m) return null;
  const [surah, ayah, wordPosition] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (m[4] === "G") return { surah, ayah, wordPosition, spot: GAP };
  const letter = m[5] ? Number(m[5]) : 0;
  if (m[5] && letter < 1) return null;
  return { surah, ayah, wordPosition, spot: letterSpot(letter) };
}

/** The word key ("s:a:w") of any spot key. */
export const wordKeyOf = (key: string) => key.split(":").slice(0, 3).join(":");

/** Whether a spot is valid at all: a gap is never on a letter. */
export const isValidSpot = (s: Spot) => Number.isInteger(s.letter) && s.letter >= 0 && !(s.gapAfter && s.letter > 0);

export interface DetailError {
  kind: TajweedKind;
  /** a code of taxonomy.ts, or GENERAL */
  code: string;
  /** «نُطق قريبًا من حرف»: makhraj errors only */
  confusedWith: string | null;
}

/** A form's detailed mistakes: spot key ("s:a:w:L3" / "s:a:w:G") → its errors. */
export type DetailFlags = Record<string, DetailError[]>;

export const sameDetail =(a: Pick<DetailError, "kind" | "code">, b: Pick<DetailError, "kind" | "code">) =>
  a.kind === b.kind && a.code === b.code;

/**
 * The spot's errors after adding one: the same kind + code is replaced (its
 * «قريبًا من حرف» may change); a specific code drops the kind's general
 * entry; a general entry is ignored when the kind already has a specific
 * one. Order is kept (new ones last).
 */
export function addDetail(list: DetailError[], add: DetailError): DetailError[] {
  const sameKind = list.filter((e) => e.kind === add.kind);
  if (add.code === GENERAL && sameKind.some((e) => e.code !== GENERAL)) return list;
  const i = list.findIndex((e) => sameDetail(e, add));
  if (i !== -1) return list.map((e, j) => (j === i ? add : e));
  const kept = add.code === GENERAL ? list : list.filter((e) => !(e.kind === add.kind && e.code === GENERAL));
  return [...kept, add];
}

/** The spot's errors without one (by kind + code). */
export const removeDetail = (list: DetailError[], remove: Pick<DetailError, "kind" | "code">) =>
  list.filter((e) => !sameDetail(e, remove));

/**
 * The general entries a specific one replaces when it's saved: the kind's
 * general entry on that spot, if any (for the home marks, saved one by one).
 */
export const replacedBy = (add: DetailError): Pick<DetailError, "kind" | "code"> | null =>
  add.code === GENERAL ? null : { kind: add.kind, code: GENERAL };
