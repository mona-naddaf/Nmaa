import "server-only";
import { prisma } from "@/lib/db";
import { wordAt } from "@/lib/quran-data/quran-text";
import { MISTAKE_TYPES, type MistakeType } from "@/lib/students/mistake-types";
import { mergeActiveMistakes } from "@/lib/students/mistakes";
import type { WordFlags } from "@/components/mistakes/FlaggableAyah";

// Self-marked mistakes in home practice (course students: HomeMistake).
// Strictly private to the student: this module is the only reader of the
// table, and only her own pages call it. «رفيق الحفظ» has the same thing on
// its own table (src/lib/rafiq/home-mistakes.ts), using checkMark below.

export const SELF_MARK_LIMITS = {
  tapsPerMinute: 60,
  openMax: 2000,
} as const;

export type MarkInput = { segmentId: string; ayah: number; wordPosition: number; type: MistakeType | null };

/** A real word inside the passage's range, and a known type (or null to remove). */
export function checkMark(
  segment: { surahNumber: number; fromAyah: number; toAyah: number },
  input: MarkInput,
): { error: string } | { ayah: number; wordPosition: number; wordText: string; type: MistakeType | null } {
  const ayah = Number(input?.ayah);
  const wordPosition = Number(input?.wordPosition);
  const type = input?.type ?? null;
  if (type !== null && !MISTAKE_TYPES.includes(type)) return { error: "نوع غير صحيح" };
  const inRange = Number.isInteger(ayah) && ayah >= segment.fromAyah && ayah <= segment.toAyah;
  const wordText = inRange && Number.isInteger(wordPosition) ? wordAt(segment.surahNumber, ayah, wordPosition) : null;
  if (!wordText) return { error: "كلمة خارج المقطع" };
  return { ayah, wordPosition, wordText, type };
}

const key = (r: { surahNumber: number; ayah: number; wordPosition: number }) => `${r.surahNumber}:${r.ayah}:${r.wordPosition}`;

/** Her open marks in one passage, for the practice screen. */
export async function homeMarkFlags(studentId: string, surahNumber: number, fromAyah: number, toAyah: number): Promise<WordFlags> {
  const rows = await prisma.homeMistake.findMany({
    where: { studentId, resolvedAt: null, surahNumber, ayah: { gte: fromAyah, lte: toAyah } },
    select: { surahNumber: true, ayah: true, wordPosition: true, type: true },
  });
  return Object.fromEntries(rows.map((r) => [key(r), r.type]));
}

/** Her open marks as a list, merged per word like the official list, in plan order. */
export async function homeMarkList(studentId: string, plan: number[]) {
  const rows = await prisma.homeMistake.findMany({
    where: { studentId, resolvedAt: null },
    select: { surahNumber: true, ayah: true, wordPosition: true, wordText: true, type: true, flaggedAt: true },
    orderBy: { flaggedAt: "asc" },
  });
  return mergeActiveMistakes(rows, plan);
}

/** Marks (or re-types, or removes) one word of hers. At most one open mark per word. */
export async function setHomeMark(
  studentId: string,
  surahNumber: number,
  mark: { ayah: number; wordPosition: number; wordText: string; type: MistakeType | null },
): Promise<{ error?: string }> {
  const word = { studentId, surahNumber, ayah: mark.ayah, wordPosition: mark.wordPosition, resolvedAt: null };
  const open = await prisma.homeMistake.findFirst({ where: word, select: { id: true } });
  if (mark.type === null) {
    if (open) await prisma.homeMistake.delete({ where: { id: open.id } });
    return {};
  }
  if (open) {
    await prisma.homeMistake.update({ where: { id: open.id }, data: { type: mark.type } });
    return {};
  }
  const [recent, total] = await Promise.all([
    prisma.homeMistake.count({ where: { studentId, flaggedAt: { gt: new Date(Date.now() - 60 * 1000) } } }),
    prisma.homeMistake.count({ where: { studentId, resolvedAt: null } }),
  ]);
  if (recent >= SELF_MARK_LIMITS.tapsPerMinute) return { error: "تحديدات كثيرة في وقت قصير — يُرجى التمهّل قليلًا" };
  if (total >= SELF_MARK_LIMITS.openMax) return { error: "وصلت قائمة الكلمات إلى حدّها — يُرجى تعليم بعضها متقَنًا أولًا" };
  try {
    await prisma.homeMistake.create({ data: { ...word, wordText: mark.wordText, type: mark.type } });
  } catch {
    // a double tap raced the first: the open mark already exists
    await prisma.homeMistake.updateMany({ where: word, data: { type: mark.type } });
  }
  return {};
}

/** Resolves her open mark on one word. */
export async function resolveHomeMark(studentId: string, surahNumber: number, ayah: number, wordPosition: number): Promise<boolean> {
  const { count } = await prisma.homeMistake.updateMany({
    where: { studentId, surahNumber, ayah, wordPosition, resolvedAt: null },
    data: { resolvedAt: new Date() },
  });
  return count > 0;
}
