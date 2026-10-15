"use server";

import { prisma } from "@/lib/db";
import { getRafiqUser } from "@/lib/rafiq/session";
import { similarForSurah, similarVerseTexts, type SimilarGroup } from "@/lib/mutashabihat/data";

// «المتشابهات» for a «رفيق الحفظ» user: only while her «إظهار المتشابهات» is on.

const OFF = { error: "المتشابهات غير مفعّلة في إعداداتك" };

async function allowed(): Promise<boolean> {
  const user = await getRafiqUser();
  if (!user) return false;
  const row = await prisma.rafiqUser.findUnique({ where: { id: user.id }, select: { mutashabihatEnabled: true } });
  return row?.mutashabihatEnabled === true;
}

export async function rafiqSimilarSurahAction(surah: unknown): Promise<Record<number, SimilarGroup[]> | { error: string }> {
  if (!(await allowed())) return OFF;
  return similarForSurah(surah) ?? { error: "سورة غير صحيحة" };
}

export async function rafiqSimilarVersesAction(keys: unknown): Promise<Record<string, string> | { error: string }> {
  if (!(await allowed())) return OFF;
  return similarVerseTexts(keys) ?? { error: "طلب غير صحيح" };
}
