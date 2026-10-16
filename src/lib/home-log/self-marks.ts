import "server-only";
import { prisma } from "@/lib/db";
import { wordAt } from "@/lib/quran-data/quran-text";
import { MISTAKE_TYPES, type MistakeType } from "@/lib/students/mistake-types";
import { MISTAKE_SELECT, mergeActiveMistakes, withNextWords } from "@/lib/students/mistakes";
import { spotKey, type DetailFlags, type Spot } from "@/lib/tajweed/spots";
import type { TajweedKind } from "@/lib/tajweed/taxonomy";
import type { CheckedDetail } from "@/lib/tajweed/validate";
import { studentTimeZone } from "@/lib/time/course-zone";
import { zoneDayOf } from "@/lib/time/zone";
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

/** A plain mark is on the whole word (detailed ones sit on a letter or a gap, lib/tajweed). */
const PLAIN = { letter: 0, gapAfter: false, tajweedKind: "NONE" } as const;

/** Her open marks in one passage, for the practice screen. */
export async function homeMarkFlags(studentId: string, surahNumber: number, fromAyah: number, toAyah: number): Promise<WordFlags> {
  const rows = await prisma.homeMistake.findMany({
    where: { studentId, resolvedAt: null, surahNumber, ayah: { gte: fromAyah, lte: toAyah }, ...PLAIN },
    select: { surahNumber: true, ayah: true, wordPosition: true, type: true },
  });
  return Object.fromEntries(rows.map((r) => [key(r), r.type]));
}

/** Her open detailed marks in one passage, by spot, for the practice screen. */
export async function homeMarkDetails(studentId: string, surahNumber: number, fromAyah: number, toAyah: number): Promise<DetailFlags> {
  const rows = await prisma.homeMistake.findMany({
    where: { studentId, resolvedAt: null, surahNumber, ayah: { gte: fromAyah, lte: toAyah }, tajweedKind: { not: "NONE" } },
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

/** Her open marks as a list, merged per word like the official list, in plan order. */
export async function homeMarkList(studentId: string, plan: number[]) {
  const rows = await prisma.homeMistake.findMany({
    where: { studentId, resolvedAt: null },
    select: { ...MISTAKE_SELECT, flaggedAt: true },
    orderBy: { flaggedAt: "asc" },
  });
  const timeZone = await studentTimeZone(studentId);
  return withNextWords(mergeActiveMistakes(rows, plan, (d) => zoneDayOf(timeZone, d)));
}

/** Marks (or re-types, or removes) one word of hers. At most one open mark per word. */
export async function setHomeMark(
  studentId: string,
  surahNumber: number,
  mark: { ayah: number; wordPosition: number; wordText: string; type: MistakeType | null },
): Promise<{ error?: string }> {
  const word = { studentId, surahNumber, ayah: mark.ayah, wordPosition: mark.wordPosition, resolvedAt: null, ...PLAIN };
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

/** Resolves her open (plain) mark on one word. */
export async function resolveHomeMark(studentId: string, surahNumber: number, ayah: number, wordPosition: number): Promise<boolean> {
  const { count } = await prisma.homeMistake.updateMany({
    where: { studentId, surahNumber, ayah, wordPosition, resolvedAt: null, ...PLAIN },
    data: { resolvedAt: new Date() },
  });
  return count > 0;
}

/**
 * «تم الإتقان» on her detailed marks: every open one on a letter or gap,
 * or with `only`, just that one. The rows stay (resolvedAt stamped).
 */
export async function resolveHomeDetail(
  studentId: string,
  surahNumber: number,
  ayah: number,
  wordPosition: number,
  spot: Spot,
  only?: { kind: TajweedKind; code: string },
): Promise<boolean> {
  const { count } = await prisma.homeMistake.updateMany({
    where: {
      studentId,
      surahNumber,
      ayah,
      wordPosition,
      letter: spot.letter,
      gapAfter: spot.gapAfter,
      resolvedAt: null,
      tajweedKind: only ? only.kind : { not: "NONE" },
      ...(only ? { tajweedCode: only.code } : {}),
    },
    data: { resolvedAt: new Date() },
  });
  return count > 0;
}

/**
 * Her detailed marks on one letter or gap become exactly `errors` (already
 * checked and combined, lib/tajweed/validate.ts): new ones added, removed
 * ones deleted (taken back, not mastered), a changed «قريبًا من حرف»
 * updated. The same limits as her plain marks.
 */
export async function setHomeSpot(
  studentId: string,
  surahNumber: number,
  spot: { ayah: number; wordPosition: number; letter: number; gapAfter: boolean; wordText: string; letterText: string | null },
  errors: Pick<CheckedDetail, "kind" | "code" | "confusedWith">[],
): Promise<{ error?: string }> {
  const where = {
    studentId,
    surahNumber,
    ayah: spot.ayah,
    wordPosition: spot.wordPosition,
    letter: spot.letter,
    gapAfter: spot.gapAfter,
    resolvedAt: null,
  };
  const open = await prisma.homeMistake.findMany({
    where: { ...where, tajweedKind: { not: "NONE" } },
    select: { id: true, tajweedKind: true, tajweedCode: true, confusedWith: true },
  });
  const same = (o: (typeof open)[number], e: (typeof errors)[number]) => o.tajweedKind === e.kind && o.tajweedCode === e.code;
  const removed = open.filter((o) => !errors.some((e) => same(o, e)));
  const added = errors.filter((e) => !open.some((o) => same(o, e)));
  const changed = errors.filter((e) => open.some((o) => same(o, e) && o.confusedWith !== e.confusedWith));

  if (added.length > 0) {
    const [recent, total] = await Promise.all([
      prisma.homeMistake.count({ where: { studentId, flaggedAt: { gt: new Date(Date.now() - 60 * 1000) } } }),
      prisma.homeMistake.count({ where: { studentId, resolvedAt: null } }),
    ]);
    if (recent + added.length > SELF_MARK_LIMITS.tapsPerMinute) return { error: "تحديدات كثيرة في وقت قصير — يُرجى التمهّل قليلًا" };
    if (total + added.length - removed.length > SELF_MARK_LIMITS.openMax) {
      return { error: "وصلت قائمة الكلمات إلى حدّها — يُرجى تعليم بعضها متقَنًا أولًا" };
    }
  }
  try {
    await prisma.$transaction([
      prisma.homeMistake.deleteMany({ where: { id: { in: removed.map((o) => o.id) } } }),
      ...changed.map((e) =>
        prisma.homeMistake.updateMany({ where: { ...where, tajweedKind: e.kind, tajweedCode: e.code }, data: { confusedWith: e.confusedWith } }),
      ),
      ...added.map((e) =>
        prisma.homeMistake.create({
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
