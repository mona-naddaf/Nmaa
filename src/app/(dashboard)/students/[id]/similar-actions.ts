"use server";

import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth/require";
import { similarForSurah, similarVerseTexts, type SimilarGroup } from "@/lib/mutashabihat/data";

// «المتشابهات» for teachers and the supervisor (the recitation form's word
// picker): only while the course has «للمعلمين والمشرفين» on.

const OFF = { error: "المتشابهات غير مفعّلة للمعلمين في هذه الدورة" };

async function allowed(): Promise<boolean> {
  // a teacher row that is gone or moved is refused (requireSession)
  const session = await requireSession();
  const course = await prisma.course.findUnique({ where: { id: session.courseId }, select: { mutashabihatTeachersEnabled: true } });
  return course?.mutashabihatTeachersEnabled === true;
}

export async function staffSimilarSurahAction(surah: unknown): Promise<Record<number, SimilarGroup[]> | { error: string }> {
  if (!(await allowed())) return OFF;
  return similarForSurah(surah) ?? { error: "سورة غير صحيحة" };
}

export async function staffSimilarVersesAction(keys: unknown): Promise<Record<string, string> | { error: string }> {
  if (!(await allowed())) return OFF;
  return similarVerseTexts(keys) ?? { error: "طلب غير صحيح" };
}
