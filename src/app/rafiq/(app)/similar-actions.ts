"use server";

import { prisma } from "@/lib/db";
import { resolveSubject } from "@/lib/rafiq/subject";
import { similarForSurah, similarVerseTexts, type SimilarGroup } from "@/lib/mutashabihat/data";

// «المتشابهات» for a «رفيق الحفظ» user: only while her «إظهار المتشابهات» is on
// (subjectId: «العائلة», a child's page — the child's own setting counts).

const OFF = { error: "المتشابهات غير مفعّلة في إعداداتك" };

async function allowed(subjectId: unknown): Promise<boolean> {
  const user = await resolveSubject(subjectId, "view");
  if ("error" in user) return false;
  const row = await prisma.rafiqUser.findUnique({ where: { id: user.id }, select: { mutashabihatEnabled: true } });
  return row?.mutashabihatEnabled === true;
}

export async function rafiqSimilarSurahAction(surah: unknown, subjectId?: string): Promise<Record<number, SimilarGroup[]> | { error: string }> {
  if (!(await allowed(subjectId))) return OFF;
  return similarForSurah(surah) ?? { error: "سورة غير صحيحة" };
}

export async function rafiqSimilarVersesAction(keys: unknown, subjectId?: string): Promise<Record<string, string> | { error: string }> {
  if (!(await allowed(subjectId))) return OFF;
  return similarVerseTexts(keys) ?? { error: "طلب غير صحيح" };
}
