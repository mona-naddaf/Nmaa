// «الحفظ السابق»: a range of the plan picked in «من سورة… / إلى سورة…» but
// not yet applied with «تحديد كمحفوظ بالكامل». Rafiq and «العائلة» add it
// on save, as if it had been applied. Pure.

import { planRange, type PriorPartial } from "@/lib/students/new-student";

export type PriorValue = { completedSurahs: number[]; partial: PriorPartial | null };

/**
 * The prior memorization with the pending range included: its surahs join
 * the completed ones (no repeats), and a partial surah inside it is dropped
 * — exactly what «تحديد كمحفوظ بالكامل» does. Unchanged without a valid range.
 */
export function withPendingRange(plan: number[], prior: PriorValue, from: number | null, to: number | null): PriorValue {
  if (from == null || to == null) return prior;
  const range = planRange(plan, from, to);
  if (!range) return prior;
  return {
    completedSurahs: [...new Set([...prior.completedSurahs, ...range])],
    partial: prior.partial && range.includes(prior.partial.surahNumber) ? null : prior.partial,
  };
}
