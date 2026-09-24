import { AYAH_COUNT, SURAH_NAME, TOTAL_PAGES, getAyahPageEntries } from "@/lib/quran-data";
import { juzOf, juzSegments, juzTotalPages } from "@/lib/quran-data/juz";
import { advancesPosition, type FurthestPosition, type SessionType } from "@/lib/recitation/logic";

// Which ayat a student has recited at least once, by surah — overlapping and
// repeated sessions collapse, so page totals built on this can't exceed 100%
// the way a plain SUM(pagesCalculated) can. Only NEW sessions count: a
// REVIEW/LINK of never-memorized ayat must not inflate her coverage.
export type Coverage = Map<number, Set<number>>;

export function buildCoverage(
  sessions: { surahNumber: number; fromAyah: number; toAyah: number; type: SessionType }[],
): Coverage {
  const coverage: Coverage = new Map();
  for (const s of sessions) {
    if (!advancesPosition(s)) continue;
    const count = AYAH_COUNT[s.surahNumber];
    if (!count) continue;
    const ayat = coverage.get(s.surahNumber) ?? new Set<number>();
    for (let a = Math.max(1, s.fromAyah); a <= Math.min(count, s.toAyah); a++) ayat.add(a);
    coverage.set(s.surahNumber, ayat);
  }
  return coverage;
}

/** Compact form for the client: surah → sorted, merged [from, to] ayah ranges. */
export function coverageToRanges(coverage: Coverage): Record<number, [number, number][]> {
  const out: Record<number, [number, number][]> = {};
  for (const [surah, ayat] of coverage) {
    const sorted = [...ayat].sort((a, b) => a - b);
    const ranges: [number, number][] = [];
    for (const a of sorted) {
      const last = ranges[ranges.length - 1];
      if (last && a === last[1] + 1) last[1] = a;
      else ranges.push([a, a]);
    }
    out[surah] = ranges;
  }
  return out;
}

/** True when every ayah in [from, to] lies inside the given (sorted, merged) ranges. */
export function rangeIsMemorized(ranges: [number, number][] | undefined, from: number, to: number): boolean {
  let next = from;
  for (const [a, b] of ranges ?? []) {
    if (a > next) break;
    if (b >= next) next = b + 1;
    if (next > to) return true;
  }
  return next > to;
}

function pagesOf(surahNumber: number, fromAyah: number, toAyah: number, onlyCovered?: Set<number>): number {
  const entries = getAyahPageEntries(surahNumber);
  if (!entries) return 0;
  let total = 0;
  for (let a = fromAyah; a <= toAyah; a++) {
    if (!onlyCovered || onlyCovered.has(a)) total += entries[a - 1][0];
  }
  return total;
}

function coveredPagesInSurahs(coverage: Coverage, surahs: Iterable<number>): number {
  let total = 0;
  for (const s of surahs) {
    const ayat = coverage.get(s);
    if (ayat) total += pagesOf(s, 1, AYAH_COUNT[s], ayat);
  }
  return total;
}

/** Distinct pages recited anywhere in the Quran, rounded like cumPages. */
export function coveredQuranPages(coverage: Coverage): number {
  return round3(coveredPagesInSurahs(coverage, coverage.keys()));
}

export type ProgressBarKey = "surah" | "juz" | "quran" | "plan";

export interface ProgressBar {
  key: ProgressBarKey;
  label: string;
  detail: string;
  percent: number;
}

export interface ProgressBarSettings {
  showSurahProgress: boolean;
  showJuzProgress: boolean;
  showQuranProgress: boolean;
  showPlanProgress: boolean;
}

/**
 * The progress bars to show on a student's detail screen: only those enabled
 * course-wide AND well-defined for this student. A bar whose underlying
 * number doesn't exist (no position yet, empty plan, …) is omitted rather
 * than rendered empty.
 */
export function computeProgressBars({
  settings,
  plan,
  furthest,
  coverage,
}: {
  settings: ProgressBarSettings;
  plan: number[];
  furthest: FurthestPosition | null;
  coverage: Coverage;
}): ProgressBar[] {
  const bars: ProgressBar[] = [];

  if (settings.showSurahProgress && furthest) {
    const total = AYAH_COUNT[furthest.surahNumber];
    if (total) {
      bars.push({
        key: "surah",
        label: `حتى نهاية سورة ${SURAH_NAME[furthest.surahNumber]}`,
        detail: `الآية ${furthest.ayah} من ${total}`,
        percent: toPercent(furthest.ayah, total),
      });
    }
  }

  // Coverage within the juz rather than "position within the juz": reverse
  // plans walk a juz from its last surah back to its first, so a linear
  // position would read near-100% on day one.
  if (settings.showJuzProgress && furthest) {
    const juz = juzOf(furthest.surahNumber, furthest.ayah);
    const total = juz ? juzTotalPages(juz) : 0;
    if (juz && total > 0) {
      let covered = 0;
      for (const seg of juzSegments(juz)) {
        const ayat = coverage.get(seg.surahNumber);
        if (ayat) covered += pagesOf(seg.surahNumber, seg.fromAyah, seg.toAyah, ayat);
      }
      bars.push({
        key: "juz",
        label: `حتى نهاية الجزء ${juz}`,
        detail: `${round1(covered)} من ${round1(total)} صفحة`,
        percent: toPercent(covered, total),
      });
    }
  }

  if (settings.showQuranProgress) {
    const covered = coveredQuranPages(coverage);
    bars.push({
      key: "quran",
      label: "القرآن كامل",
      detail: `${round1(covered)} من ${TOTAL_PAGES} صفحة`,
      percent: toPercent(covered, TOTAL_PAGES),
    });
  }

  if (settings.showPlanProgress && plan.length > 0) {
    const total = plan.reduce((sum, s) => sum + pagesOf(s, 1, AYAH_COUNT[s] ?? 0), 0);
    if (total > 0) {
      const covered = coveredPagesInSurahs(coverage, plan);
      bars.push({
        key: "plan",
        label: "إتمام الخطة الحالية",
        detail: `${round1(covered)} من ${round1(total)} صفحة`,
        percent: toPercent(covered, total),
      });
    }
  }

  return bars;
}

function toPercent(value: number, total: number): number {
  return Math.min(100, Math.round((value / total) * 1000) / 10);
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}
