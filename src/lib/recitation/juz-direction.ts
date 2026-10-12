import { AYAH_COUNT, MUSHAF_REVERSE_ORDER } from "@/lib/quran-data";
import { groupJuzOfSurah, juzGroupSurahs } from "@/lib/quran-data/juz";
import {
  advancesPosition,
  classifyRecitation,
  deriveReach,
  type Classification,
  type PositionSession,
  type RecitationSubject,
} from "./logic";

// «ترتيب المصحف بالعكس» with a direction per juz. The juz still go from 30
// down to 1, but a student may take each juz from its first surah («من
// أوله», e.g. juz 30 from An-Naba) or from its last («من آخره», from
// An-Nas) — the original reverse order, and what an undecided juz follows.
// The unit stays the whole surah: each juz owns the surahs of
// JUZ_SURAH_GROUPS, and a juz with fewer than two has no direction.
//
// Pure, so the recitation form classifies exactly like the server and the
// offline sheet. Only an untouched reverse plan has directions; any other
// plan (other templates, or a reverse plan edited by hand) is used as stored.

export type JuzDirection = "FROM_START" | "FROM_END";
export type JuzDirections = Partial<Record<number, JuzDirection>>;

export const JUZ_DIRECTION_LABEL: Record<JuzDirection, string> = { FROM_START: "من أوله", FROM_END: "من آخره" };

/** The juz where a direction means something, 30 down to 1. */
export const DIRECTIONAL_JUZ: number[] = Array.from({ length: 30 }, (_, i) => 30 - i).filter((j) => juzGroupSurahs(j).length >= 2);

export function juzHasDirection(juz: number): boolean {
  return DIRECTIONAL_JUZ.includes(juz);
}

/** Whether a stored plan is the reverse template untouched — the only plan directions apply to. */
export function isStockReverse(template: string, surahs: number[]): boolean {
  return template === "MUSHAF_REVERSE" && surahs.length === MUSHAF_REVERSE_ORDER.length && surahs.every((s, i) => s === MUSHAF_REVERSE_ORDER[i]);
}

/**
 * The reverse plan with each juz in its direction. With no juz «من أوله»
 * this is exactly MUSHAF_REVERSE_ORDER.
 */
export function reverseOrder(directions: JuzDirections): number[] {
  const order: number[] = [];
  for (let juz = 30; juz >= 1; juz--) {
    const surahs = juzGroupSurahs(juz);
    order.push(...(directions[juz] === "FROM_START" ? surahs : surahs.reverse()));
  }
  return order;
}

export interface JuzAdoption {
  juz: number;
  direction: JuzDirection;
}

export interface DirectionalClassification {
  classification: Classification;
  // set when this entry decides an undecided juz; saved with the entry
  adopt: JuzAdoption | null;
}

const isNatural = (c: Classification) => c.situation === "NEXT" || c.situation === "CONTINUE";

/**
 * Classifies a new-memorization entry for a reverse-plan student. In a juz
 * whose direction isn't decided yet, the entry is judged both ways: when it
 * is a natural step («تقدّم طبيعي» or «استكمال») in exactly one direction,
 * that direction is adopted for the juz (classified accordingly, so a
 * student starting juz 29 at Al-Mulk sees no gap warning). Otherwise —
 * a start in the middle of the juz, a gap either way — the juz stays
 * undecided and the entry is judged as «من آخره», as before.
 *
 * `sessions` are the ones position logic sees (planChangedAt applied); the
 * reach is derived per order, since an approved gap at a surah's first ayah
 * passes through whatever comes before it in that order.
 */
export function classifyWithDirections(
  directions: JuzDirections,
  sessions: PositionSession[],
  surahNumber: number,
  fromAyah: number,
  subject: RecitationSubject,
): DirectionalClassification {
  const classifyIn = (dirs: JuzDirections) => {
    const plan = reverseOrder(dirs);
    return classifyRecitation(plan, deriveReach(plan, sessions), surahNumber, fromAyah, subject);
  };
  const current = classifyIn(directions);
  const juz = groupJuzOfSurah(surahNumber);
  if (!juz || !juzHasDirection(juz) || directions[juz]) return { classification: current, adopt: null };

  const fromStart = classifyIn({ ...directions, [juz]: "FROM_START" });
  if (isNatural(fromStart) && !isNatural(current)) return { classification: fromStart, adopt: { juz, direction: "FROM_START" } };
  if (isNatural(current) && !isNatural(fromStart)) return { classification: current, adopt: { juz, direction: "FROM_END" } };
  return { classification: current, adopt: null };
}

/**
 * The order a range spanning several surahs (an offline-sheet row) is read
 * in: as decided so far, except that a range going forward through one
 * undecided juz shows that juz is taken «من أوله».
 */
export function orderForRange(directions: JuzDirections, fromSurah: number, toSurah: number): number[] {
  const juz = groupJuzOfSurah(fromSurah);
  if (juz && juz === groupJuzOfSurah(toSurah) && juzHasDirection(juz) && !directions[juz] && fromSurah < toSurah) {
    return reverseOrder({ ...directions, [juz]: "FROM_START" });
  }
  return reverseOrder(directions);
}

/** «تم اعتماد اتجاه الجزء 29: من أوله» — the line shown after the save. */
export function adoptionMessage(adopt: JuzAdoption): string {
  return `تم اعتماد اتجاه الجزء ${adopt.juz}: ${JUZ_DIRECTION_LABEL[adopt.direction]}`;
}

// ---------- inferring directions from what she has already memorized ----------

export interface InferenceSession {
  surahNumber: number;
  fromAyah: number;
  toAyah: number;
  type: "NEW" | "REVIEW" | "LINK";
  source: "LOGGED" | "PRIOR";
  occurredAt: Date;
}

export type InferenceBasis =
  // her coverage in the juz is a natural run from its first surah / its last
  | "coverage"
  // coverage alone doesn't tell; her first logged entry there began the juz
  | "first-entry"
  // neither: left undecided (behaves as «من آخره»)
  | "unclear"
  // the whole juz is memorized: its direction no longer changes anything
  | "complete";

export interface InferredJuz {
  juz: number;
  direction: JuzDirection | null;
  basis: InferenceBasis;
  // for the report: her first logged new entry in the juz, if any
  firstEntry: { surahNumber: number; fromAyah: number } | null;
}

/**
 * For every directional juz she has touched with new memorization (prior
 * baselines included), the direction her history shows. Used once for
 * students who had sessions before directions existed, and when prior
 * memorization is added. A juz is decided by its coverage when that is
 * exactly what walking it one way would produce — every surah before the
 * first unfinished one complete, that one memorized from ayah 1, nothing
 * after it — and in only one direction; failing that, by whether her first
 * logged entry there opened its first or its last surah.
 */
export function inferJuzDirections(sessions: InferenceSession[]): InferredJuz[] {
  const covered = new Map<number, Set<number>>();
  for (const s of sessions) {
    if (!advancesPosition(s)) continue;
    const count = AYAH_COUNT[s.surahNumber];
    if (!count) continue;
    const ayat = covered.get(s.surahNumber) ?? new Set<number>();
    for (let a = Math.max(1, s.fromAyah); a <= Math.min(count, s.toAyah); a++) ayat.add(a);
    covered.set(s.surahNumber, ayat);
  }
  const done = (s: number) => (covered.get(s)?.size ?? 0) >= AYAH_COUNT[s];
  const touched = (s: number) => (covered.get(s)?.size ?? 0) > 0;
  const fromAyahOne = (s: number) => {
    const ayat = covered.get(s);
    if (!ayat) return true;
    for (let a = 1; a <= ayat.size; a++) if (!ayat.has(a)) return false;
    return true;
  };
  const walksAs = (order: number[]) => {
    const k = order.findIndex((s) => !done(s));
    return k === -1 || (fromAyahOne(order[k]) && order.slice(k + 1).every((s) => !touched(s)));
  };

  const logged = sessions
    .filter((s) => s.source === "LOGGED" && advancesPosition(s))
    .sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime());

  const result: InferredJuz[] = [];
  for (const juz of DIRECTIONAL_JUZ) {
    const surahs = juzGroupSurahs(juz);
    if (!surahs.some(touched)) continue;
    const first = logged.find((s) => surahs.includes(s.surahNumber));
    const firstEntry = first ? { surahNumber: first.surahNumber, fromAyah: first.fromAyah } : null;
    if (surahs.every(done)) {
      result.push({ juz, direction: null, basis: "complete", firstEntry });
      continue;
    }
    const asStart = walksAs(surahs);
    const asEnd = walksAs([...surahs].reverse());
    if (asStart !== asEnd) {
      result.push({ juz, direction: asStart ? "FROM_START" : "FROM_END", basis: "coverage", firstEntry });
    } else if (firstEntry && firstEntry.fromAyah === 1 && firstEntry.surahNumber === surahs[0]) {
      result.push({ juz, direction: "FROM_START", basis: "first-entry", firstEntry });
    } else if (firstEntry && firstEntry.fromAyah === 1 && firstEntry.surahNumber === surahs[surahs.length - 1]) {
      result.push({ juz, direction: "FROM_END", basis: "first-entry", firstEntry });
    } else {
      result.push({ juz, direction: null, basis: "unclear", firstEntry });
    }
  }
  return result;
}
