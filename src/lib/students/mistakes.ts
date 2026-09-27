import "server-only";
import { prisma } from "@/lib/db";
import type { ActiveMistake } from "@/lib/students/mistake-types";

/**
 * A student's unresolved flagged words, one entry per word: repeated flags
 * on the same word merge into one with a count, the most recent flag's type
 * and the earliest flag's date. Sorted for practice — by surah in the
 * student's plan order (surahs outside the plan last, in Mushaf order), then
 * in reading order within the surah.
 */
export async function getActiveMistakes(studentId: string, plan: number[]): Promise<ActiveMistake[]> {
  const rows = await prisma.recitationMistake.findMany({
    where: { studentId, resolvedAt: null },
    select: { surahNumber: true, ayah: true, wordPosition: true, wordText: true, type: true, flaggedAt: true, createdAt: true },
    // oldest first, so the last row seen per word is its most recent flag
    orderBy: [{ flaggedAt: "asc" }, { createdAt: "asc" }],
  });

  const byWord = new Map<string, ActiveMistake>();
  for (const r of rows) {
    const key = `${r.surahNumber}:${r.ayah}:${r.wordPosition}`;
    const existing = byWord.get(key);
    if (existing) {
      existing.count++;
      existing.type = r.type;
    } else {
      byWord.set(key, {
        surahNumber: r.surahNumber,
        ayah: r.ayah,
        wordPosition: r.wordPosition,
        wordText: r.wordText,
        type: r.type,
        count: 1,
        firstFlagged: r.flaggedAt.toISOString().slice(0, 10),
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
