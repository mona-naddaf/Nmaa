// Smart ordering for the detailed tajweed picker: which rule groups are
// most likely for the letter or gap that was tapped, from a few simple
// looks at the written text. Never a tajweed engine and never hiding: the
// picker always lists every group, the likely ones first. Pure and
// client-safe.

import {
  hasHaraka,
  hasMaddah,
  hasShadda,
  hasSukun,
  hasTanween,
  IQLAB_MEEMS,
  isMaddLetter,
  isSilent,
  splitLetters,
  type LetterUnit,
} from "./letters";
import { sifatFor, makharijFor, SIFAT, type MakhrajCode, type SifaCode } from "./letter-facts";
import { groupsFor, type HukmGroup, type SpotTarget } from "./taxonomy";

const QALQALA = new Set([..."قطبجد"]);
const ISTILA = new Set([..."خصضغطقظ"]);
// pause signs that follow a word as their own token (words.ts `marks`)
const PAUSES = [..."ۖۗۘۙۚۛ"];
const SAKT = "ۜ";

/** The word without marks or tatweel, ٱ/آ read as ا. */
const bare = (word: string) =>
  word
    .replace(/\p{M}|ـ/gu, "")
    .replace(/[ٱآ]/g, "ا")
    .replace(/ۥ|ۦ/g, "");

/** لفظ الجلالة with its prefixes: ٱللَّه، لِلَّه، وَٱللَّه، بِٱللَّه، تَٱللَّه، ٱللَّهُمَّ ... */
export const isJalala = (word: string) => /^(?:ء|أ)?(?:[وف]?[بتل]?)?ا?لله(?:م)?$/.test(bare(word));

/** The unit read last: a silent or bare trailing ا/ى after tanween is skipped. */
function lastVoiced(units: LetterUnit[]): LetterUnit | undefined {
  const last = units[units.length - 1];
  const prev = units[units.length - 2];
  if (last && prev && (isSilent(last) || ((last.base === "ا" || last.base === "ى") && !last.marks && hasTanween(prev)))) return prev;
  return last;
}

const isNoonSakin = (u: LetterUnit | undefined, before: LetterUnit | undefined) =>
  !!u && u.letter === "ن" && !hasShadda(u) && (hasSukun(u) || (!hasHaraka(u) && !isMaddLetter(u, before)));
const isMeemSakin = (u: LetterUnit | undefined) => !!u && u.letter === "م" && !hasShadda(u) && (hasSukun(u) || !hasHaraka(u));

// the Hafs special places, read from their signs in the text
function isHafsSpecial(word: string, units: LetterUnit[]): boolean {
  if (/[۪۫۬]/.test(word)) return true; // ۪ imala, ۫ ishmam, ۬ tas-hil
  // ءَآلذَّكَرَيْنِ، ءَآلْـَٔـٰنَ، ءَآللَّهُ: a hamza, then آ (ا + ٓ in the text) before a lam
  if (/^\u0621\u064e?(?:\u0622|\u0627\u0653)\u0644/.test(word.replace(/ـ/g, ""))) return true;
  if (units.some((u) => u.base === "ص" && /[ۣۜ]/.test(u.marks))) return true; // يَبْصُۜطُ، ٱلْمُصَۣيْطِرُونَ
  return /ضعف/.test(bare(word));
}

/**
 * The rule groups (codes) most likely for one letter unit (1-based index),
 * the likeliest first.
 */
export function suggestLetterGroups(word: string, index: number): string[] {
  const units = splitLetters(word);
  const u = units[index - 1];
  if (!u) return [];
  const before = units[index - 2];
  const after = units[index];
  const out: string[] = [];
  const add = (code: string) => !out.includes(code) && out.push(code);

  if (isHafsSpecial(word, units)) add("hafs");
  if (u.letter === "ل" && hasShadda(u) && isJalala(word)) add("tafkhim");
  if ((u.letter === "ن" || u.letter === "م") && hasShadda(u)) add("ghunna");
  if (isNoonSakin(u, before) || hasTanween(u) || IQLAB_MEEMS.some((m) => u.marks.includes(m))) add("noon");
  if (isMeemSakin(u)) add("meem");
  if (u.letter === "ل" && (before?.base === "ٱ" || hasSukun(u) || !hasHaraka(u))) add("lam");
  if (isMaddLetter(u, before) || hasMaddah(u) || u.marks.includes("ٰ")) {
    add("madd");
    if (u.letter === "ا") add("tafkhim"); // the alif follows the letter before it
  }
  if (QALQALA.has(u.letter)) add("qalqala");
  if (u.letter === "ر" || ISTILA.has(u.letter)) add("tafkhim");
  // a letter with no sign of its own merged into a doubled one: نَخْلُقكُّم
  if (after && hasShadda(after) && !u.marks && !isMaddLetter(u, before) && u.base !== "ٱ") add("idgham_word");
  // stopping on the word: ة as ه, tanween al-fath as alif, rawm and ishmam
  if (u === lastVoiced(units) || u === units[units.length - 1]) add("waqf_word");
  return out;
}

export interface GapContext {
  /** the word before the gap, and the pause signs that follow it */
  left: string;
  leftMarks: string;
  /** the word after it */
  right: string;
  /** the gap is at the end of an ayah */
  ayahEnd: boolean;
}

/** The rule groups (codes) most likely for the gap between two words. */
export function suggestGapGroups(g: GapContext): string[] {
  const left = splitLetters(g.left);
  const right = splitLetters(g.right);
  const last = lastVoiced(left);
  const beforeLast = last ? left[last.index - 2] : undefined;
  const first = right[0];
  const out: string[] = [];
  const add = (code: string) => !out.includes(code) && out.push(code);

  if (g.leftMarks.includes(SAKT)) add("gap_sakt");
  if (g.ayahEnd) add("gap_waqf");
  // يسٓ / نٓ before a waw: the izhar of Hafs
  if (/^(?:يس|ن)$/.test(bare(g.left))) add("gap_idgham");
  if (last && (isNoonSakin(last, beforeLast) || hasTanween(last))) add("gap_noon");
  if (isMeemSakin(last)) add("gap_meem");
  if (last && (isMaddLetter(last, beforeLast) || hasMaddah(last))) {
    if (first?.letter === "ء") add("gap_madd");
    if (first?.base === "ٱ") add("gap_madd");
  }
  if (last?.base === "ۥ" || last?.base === "ۦ") add("gap_madd"); // الصلة
  if (first?.base === "ٱ") add("gap_wasl");
  // a sakin letter into a doubled one: ٱضْرِب بِّعَصَاكَ، قُل رَّبِّ، قَد تَّبَيَّنَ
  if (last && first && hasShadda(first) && (hasSukun(last) || !hasHaraka(last)) && !isMaddLetter(last, beforeLast)) add("gap_idgham");
  if (PAUSES.some((p) => g.leftMarks.includes(p))) add("gap_waqf");
  return out;
}

/** Every group of a target, the suggested ones first (in suggestion order). */
export function orderedGroups(target: SpotTarget, suggested: string[]): { group: HukmGroup; suggested: boolean }[] {
  const all = groupsFor(target);
  const first = suggested.map((c) => all.find((g) => g.code === c)).filter((g): g is HukmGroup => !!g);
  return [
    ...first.map((group) => ({ group, suggested: true })),
    ...all.filter((g) => !first.includes(g)).map((group) => ({ group, suggested: false })),
  ];
}

/** Every sifa, the letter's own first (in SIFAT order). */
export function orderedSifat(word: string, index: number): { code: SifaCode; label: string; suggested: boolean }[] {
  const units = splitLetters(word);
  const own = units[index - 1] ? sifatFor(units[index - 1], units[index - 2]) : [];
  return [
    ...SIFAT.filter((s) => own.includes(s.code)).map((s) => ({ ...s, suggested: true })),
    ...SIFAT.filter((s) => !own.includes(s.code)).map((s) => ({ ...s, suggested: false })),
  ];
}

/** The makharij a letter may be read from, its likely one first (letter-facts.ts). */
export function suggestMakharij(word: string, index: number): MakhrajCode[] {
  const units = splitLetters(word);
  return units[index - 1] ? makharijFor(units[index - 1], units[index - 2]) : [];
}
