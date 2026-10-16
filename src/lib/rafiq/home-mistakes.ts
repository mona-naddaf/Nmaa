import "server-only";
import { prisma } from "@/lib/db";
import { SELF_MARK_LIMITS } from "@/lib/home-log/self-marks";
import type { MistakeType } from "@/lib/students/mistake-types";
import type { WordFlags } from "@/components/mistakes/FlaggableAyah";
import { spotKey, type DetailFlags, type Spot } from "@/lib/tajweed/spots";
import type { TajweedKind } from "@/lib/tajweed/taxonomy";
import type { CheckedDetail } from "@/lib/tajweed/validate";

// Her self-marked mistakes in home practice («رفيق الحفظ»: RafiqHomeMistake),
// the same rules as a course student's (src/lib/home-log/self-marks.ts).
// They join her session mistakes in one list (memorization.ts), labelled.

const key = (r: { surahNumber: number; ayah: number; wordPosition: number }) => `${r.surahNumber}:${r.ayah}:${r.wordPosition}`;

/** A plain mark is on the whole word (detailed ones sit on a letter or a gap, lib/tajweed). */
const PLAIN = { letter: 0, gapAfter: false, tajweedKind: "NONE" } as const;

export async function rafiqMarkFlags(userId: string, surahNumber: number, fromAyah: number, toAyah: number): Promise<WordFlags> {
  const rows = await prisma.rafiqHomeMistake.findMany({
    where: { userId, resolvedAt: null, surahNumber, ayah: { gte: fromAyah, lte: toAyah }, ...PLAIN },
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
  const word = { userId, surahNumber, ayah: mark.ayah, wordPosition: mark.wordPosition, resolvedAt: null, ...PLAIN };
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

/** Her open detailed marks in one passage, by spot, for the practice screen. */
export async function rafiqMarkDetails(userId: string, surahNumber: number, fromAyah: number, toAyah: number): Promise<DetailFlags> {
  const rows = await prisma.rafiqHomeMistake.findMany({
    where: { userId, resolvedAt: null, surahNumber, ayah: { gte: fromAyah, lte: toAyah }, tajweedKind: { not: "NONE" } },
    select: { surahNumber: true, ayah: true, wordPosition: true, letter: true, gapAfter: true, tajweedKind: true, tajweedCode: true, confusedWith: true },
    orderBy: { flaggedAt: "asc" },
  });
  const out: DetailFlags = {};
  for (const r of rows) {
    const k = spotKey(r.surahNumber, r.ayah, r.wordPosition, { letter: r.letter, gapAfter: r.gapAfter });
    (out[k] ??= []).push({ kind: r.tajweedKind as TajweedKind, code: r.tajweedCode, confusedWith: r.confusedWith });
  }
  return out;
}

/** «تم الإتقان» from her practice screen: every open detailed mark of hers on one letter or gap. */
export async function resolveRafiqHomeSpot(userId: string, surahNumber: number, ayah: number, wordPosition: number, spot: Spot): Promise<boolean> {
  const { count } = await prisma.rafiqHomeMistake.updateMany({
    where: { userId, surahNumber, ayah, wordPosition, letter: spot.letter, gapAfter: spot.gapAfter, resolvedAt: null, tajweedKind: { not: "NONE" } },
    data: { resolvedAt: new Date() },
  });
  return count > 0;
}

/**
 * Her detailed marks on one letter or gap become exactly `errors` (already
 * checked and combined, lib/tajweed/validate.ts), with the same rules and
 * limits as a course student's (setHomeSpot in lib/home-log/self-marks.ts).
 */
export async function setRafiqHomeSpot(
  userId: string,
  surahNumber: number,
  spot: { ayah: number; wordPosition: number; letter: number; gapAfter: boolean; wordText: string; letterText: string | null },
  errors: Pick<CheckedDetail, "kind" | "code" | "confusedWith">[],
): Promise<{ error?: string }> {
  const where = {
    userId,
    surahNumber,
    ayah: spot.ayah,
    wordPosition: spot.wordPosition,
    letter: spot.letter,
    gapAfter: spot.gapAfter,
    resolvedAt: null,
  };
  const open = await prisma.rafiqHomeMistake.findMany({
    where: { ...where, tajweedKind: { not: "NONE" } },
    select: { id: true, tajweedKind: true, tajweedCode: true, confusedWith: true },
  });
  const same = (o: (typeof open)[number], e: (typeof errors)[number]) => o.tajweedKind === e.kind && o.tajweedCode === e.code;
  const removed = open.filter((o) => !errors.some((e) => same(o, e)));
  const added = errors.filter((e) => !open.some((o) => same(o, e)));
  const changed = errors.filter((e) => open.some((o) => same(o, e) && o.confusedWith !== e.confusedWith));

  if (added.length > 0) {
    const [recent, total] = await Promise.all([
      prisma.rafiqHomeMistake.count({ where: { userId, flaggedAt: { gt: new Date(Date.now() - 60 * 1000) } } }),
      prisma.rafiqHomeMistake.count({ where: { userId, resolvedAt: null } }),
    ]);
    if (recent + added.length > SELF_MARK_LIMITS.tapsPerMinute) return { error: "تحديدات كثيرة في وقت قصير — يُرجى التمهّل قليلًا" };
    if (total + added.length - removed.length > SELF_MARK_LIMITS.openMax) {
      return { error: "وصلت قائمة الكلمات إلى حدّها — يُرجى تعليم بعضها متقَنًا أولًا" };
    }
  }
  try {
    await prisma.$transaction([
      prisma.rafiqHomeMistake.deleteMany({ where: { id: { in: removed.map((o) => o.id) } } }),
      ...changed.map((e) =>
        prisma.rafiqHomeMistake.updateMany({ where: { ...where, tajweedKind: e.kind, tajweedCode: e.code }, data: { confusedWith: e.confusedWith } }),
      ),
      ...added.map((e) =>
        prisma.rafiqHomeMistake.create({
          data: {
            ...where,
            wordText: spot.wordText,
            letterText: spot.letterText,
            type: "TAJWEED",
            tajweedKind: e.kind,
            tajweedCode: e.code,
            confusedWith: e.confusedWith,
          },
        }),
      ),
    ]);
  } catch {
    // a double tap raced the first: those marks are already there
    return {};
  }
  return {};
}
