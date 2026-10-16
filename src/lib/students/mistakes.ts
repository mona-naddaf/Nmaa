import "server-only";
import { prisma } from "@/lib/db";
import { wordAfter } from "@/lib/quran-data/quran-text";
import { mistakeKey, type ActiveMistake, type MistakeSource, type MistakeType } from "@/lib/students/mistake-types";
import type { TajweedKind } from "@/lib/tajweed/taxonomy";
import { studentTimeZone } from "@/lib/time/course-zone";
import { zoneDayOf } from "@/lib/time/zone";

/**
 * A student's unresolved flagged words, one entry per word: repeated flags
 * on the same word merge into one with a count, the most recent flag's type
 * and the earliest flag's date. Sorted for practice — by surah in the
 * student's plan order (surahs outside the plan last, in Mushaf order), then
 * in reading order within the surah. Dates are the course's days (its time
 * zone, lib/time/zone.ts). Detailed tajweed mistakes (src/lib/tajweed) are
 * entries of their own, one per spot + kind + code.
 */
export async function getActiveMistakes(studentId: string, plan: number[]): Promise<ActiveMistake[]> {
  const rows = await prisma.recitationMistake.findMany({
    where: { studentId, resolvedAt: null },
    select: { ...MISTAKE_SELECT, flaggedAt: true, createdAt: true },
    // oldest first, so the last row seen per word is its most recent flag
    orderBy: [{ flaggedAt: "asc" }, { createdAt: "asc" }],
  });
  const timeZone = await studentTimeZone(studentId);
  return withNextWords(mergeActiveMistakes(rows, plan, (d) => zoneDayOf(timeZone, d)));
}

/** The columns a mistakes list reads (all four mistake tables have them). */
export const MISTAKE_SELECT = {
  surahNumber: true,
  ayah: true,
  wordPosition: true,
  wordText: true,
  type: true,
  letter: true,
  gapAfter: true,
  tajweedKind: true,
  tajweedCode: true,
  confusedWith: true,
  letterText: true,
} as const;

export interface MistakeRow {
  surahNumber: number;
  ayah: number;
  wordPosition: number;
  wordText: string;
  type: MistakeType;
  flaggedAt: Date;
  source?: MistakeSource;
  // detailed tajweed (absent or NONE: a plain mistake)
  letter?: number;
  gapAfter?: boolean;
  tajweedKind?: TajweedKind | "NONE";
  tajweedCode?: string;
  confusedWith?: string | null;
  letterText?: string | null;
}

/**
 * The merge and sort above, for unresolved rows already loaded oldest first
 * (a course student's, or a «رفيق الحفظ» learner's own). Rows that carry a
 * source (Rafiq's merged list) also collect where each word's flags came from.
 * dayOf: the day a flag's time is shown as (a course's: its time zone).
 */
export function mergeActiveMistakes(
  rows: MistakeRow[],
  plan: number[],
  dayOf: (d: Date) => string = (d) => d.toISOString().slice(0, 10),
): ActiveMistake[] {
  const byKey = new Map<string, ActiveMistake>();
  for (const r of rows) {
    const detail =
      r.tajweedKind && r.tajweedKind !== "NONE"
        ? {
            letter: r.letter ?? 0,
            gapAfter: r.gapAfter ?? false,
            tajweed: { kind: r.tajweedKind, code: r.tajweedCode ?? "", confusedWith: r.confusedWith ?? null },
            ...(r.letterText ? { letterText: r.letterText } : {}),
          }
        : null;
    const key = mistakeKey({ surahNumber: r.surahNumber, ayah: r.ayah, wordPosition: r.wordPosition, ...detail });
    const existing = byKey.get(key);
    if (existing) {
      existing.count++;
      existing.type = r.type;
      if (detail && existing.tajweed) existing.tajweed.confusedWith = detail.tajweed.confusedWith;
      if (r.source && !existing.sources?.includes(r.source)) existing.sources = [...(existing.sources ?? []), r.source];
    } else {
      byKey.set(key, {
        surahNumber: r.surahNumber,
        ayah: r.ayah,
        wordPosition: r.wordPosition,
        wordText: r.wordText,
        type: r.type,
        count: 1,
        firstFlagged: dayOf(r.flaggedAt),
        ...(r.source ? { sources: [r.source] } : {}),
        ...detail,
      });
    }
  }

  const planIndex = (s: number) => {
    const i = plan.indexOf(s);
    return i === -1 ? plan.length + s : i;
  };
  // within a word: the whole word, then its letters in order, then the gap after it
  const spotOrder = (m: ActiveMistake) => (m.gapAfter ? 1000 : (m.letter ?? 0));
  return [...byKey.values()].sort(
    (a, b) =>
      planIndex(a.surahNumber) - planIndex(b.surahNumber) ||
      a.ayah - b.ayah ||
      a.wordPosition - b.wordPosition ||
      spotOrder(a) - spotOrder(b),
  );
}

/** Gap mistakes get the word after the gap, for showing «كلمة ⁀ كلمة». */
export function withNextWords(list: ActiveMistake[]): ActiveMistake[] {
  for (const m of list) {
    if (m.gapAfter) m.nextWordText = wordAfter(m.surahNumber, m.ayah, m.wordPosition)?.text;
  }
  return list;
}
