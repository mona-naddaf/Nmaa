import "server-only";
import { prisma } from "@/lib/db";
import { SELF_MARK_LIMITS } from "@/lib/home-log/self-marks";
import type { MistakeType } from "@/lib/students/mistake-types";
import type { WordFlags } from "@/components/mistakes/FlaggableAyah";

// Her self-marked mistakes in home practice («رفيق الحفظ»: RafiqHomeMistake),
// the same rules as a course student's (src/lib/home-log/self-marks.ts).
// They join her session mistakes in one list (memorization.ts), labelled.

const key = (r: { surahNumber: number; ayah: number; wordPosition: number }) => `${r.surahNumber}:${r.ayah}:${r.wordPosition}`;

export async function rafiqMarkFlags(userId: string, surahNumber: number, fromAyah: number, toAyah: number): Promise<WordFlags> {
  const rows = await prisma.rafiqHomeMistake.findMany({
    where: { userId, resolvedAt: null, surahNumber, ayah: { gte: fromAyah, lte: toAyah } },
    select: { surahNumber: true, ayah: true, wordPosition: true, type: true },
  });
  return Object.fromEntries(rows.map((r) => [key(r), r.type]));
}

/** Marks (or re-types, or removes) one word of hers. At most one open mark per word. */
export async function setRafiqMark(
  userId: string,
  surahNumber: number,
  mark: { ayah: number; wordPosition: number; wordText: string; type: MistakeType | null },
): Promise<{ error?: string }> {
  const word = { userId, surahNumber, ayah: mark.ayah, wordPosition: mark.wordPosition, resolvedAt: null };
  const open = await prisma.rafiqHomeMistake.findFirst({ where: word, select: { id: true } });
  if (mark.type === null) {
    if (open) await prisma.rafiqHomeMistake.delete({ where: { id: open.id } });
    return {};
  }
  if (open) {
    await prisma.rafiqHomeMistake.update({ where: { id: open.id }, data: { type: mark.type } });
    return {};
  }
  const [recent, total] = await Promise.all([
    prisma.rafiqHomeMistake.count({ where: { userId, flaggedAt: { gt: new Date(Date.now() - 60 * 1000) } } }),
    prisma.rafiqHomeMistake.count({ where: { userId, resolvedAt: null } }),
  ]);
  if (recent >= SELF_MARK_LIMITS.tapsPerMinute) return { error: "تحديدات كثيرة في وقت قصير — يُرجى التمهّل قليلًا" };
  if (total >= SELF_MARK_LIMITS.openMax) return { error: "وصلت قائمة الكلمات إلى حدّها — يُرجى تعليم بعضها متقَنًا أولًا" };
  try {
    await prisma.rafiqHomeMistake.create({ data: { ...word, wordText: mark.wordText, type: mark.type } });
  } catch {
    await prisma.rafiqHomeMistake.updateMany({ where: word, data: { type: mark.type } });
  }
  return {};
}
