import "server-only";
import { prisma } from "@/lib/db";
import type { ActiveMistake, MistakeSource, MistakeType } from "@/lib/students/mistake-types";
import { studentTimeZone } from "@/lib/time/course-zone";
import { zoneDayOf } from "@/lib/time/zone";

/**
 * A student's unresolved flagged words, one entry per word: repeated flags
 * on the same word merge into one with a count, the most recent flag's type
 * and the earliest flag's date. Sorted for practice — by surah in the
 * student's plan order (surahs outside the plan last, in Mushaf order), then
 * in reading order within the surah. Dates are the course's days (its time
 * zone, lib/time/zone.ts).
 */
export async function getActiveMistakes(studentId: string, plan: number[]): Promise<ActiveMistake[]> {
  const rows = await prisma.recitationMistake.findMany({
    where: { studentId, resolvedAt: null },
    select: { surahNumber: true, ayah: true, wordPosition: true, wordText: true, type: true, flaggedAt: true, createdAt: true },
    // oldest first, so the last row seen per word is its most recent flag
    orderBy: [{ flaggedAt: "asc" }, { createdAt: "asc" }],
  });
  const timeZone = await studentTimeZone(studentId);
  return mergeActiveMistakes(rows, plan, (d) => zoneDayOf(timeZone, d));
}

/**
 * The merge and sort above, for unresolved rows already loaded oldest first
 * (a course student's, or a «رفيق الحفظ» learner's own). Rows that carry a
 * source (Rafiq's merged list) also collect where each word's flags came from.
 * dayOf: the day a flag's time is shown as (a course's: its time zone).
 */
export function mergeActiveMistakes(
  rows: { surahNumber: number; ayah: number; wordPosition: number; wordText: string; type: MistakeType; flaggedAt: Date; source?: MistakeSource }[],
  plan: number[],
  dayOf: (d: Date) => string = (d) => d.toISOString().slice(0, 10),
): ActiveMistake[] {
  const byWord = new Map<string, ActiveMistake>();
  for (const r of rows) {
    const key = `${r.surahNumber}:${r.ayah}:${r.wordPosition}`;
    const existing = byWord.get(key);
    if (existing) {
      existing.count++;
      existing.type = r.type;
      if (r.source && !existing.sources?.includes(r.source)) existing.sources = [...(existing.sources ?? []), r.source];
    } else {
      byWord.set(key, {
        surahNumber: r.surahNumber,
        ayah: r.ayah,
        wordPosition: r.wordPosition,
        wordText: r.wordText,
        type: r.type,
        count: 1,
        firstFlagged: dayOf(r.flaggedAt),
        ...(r.source ? { sources: [r.source] } : {}),
      });
    }
  }

  const planIndex = (s: number) => {
    const i = plan.indexOf(s);
    return i === -1 ? plan.length + s : i;
  };
  return [...byWord.values()].sort(
    (a, b) => planIndex(a.surahNumber) - planIndex(b.surahNumber) || a.ayah - b.ayah || a.wordPosition - b.wordPosition,
  );
}
