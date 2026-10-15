"use server";

import { getStudentAccess } from "@/lib/auth/student-session";
import { similarForSurah, similarVerseTexts, type SimilarGroup } from "@/lib/mutashabihat/data";

// «المتشابهات» for the signed-in student in «حفظي في البيت»: only while the
// course has student login, the home log and «للطلاب» on.

const OFF = { error: "المتشابهات غير متاحة حاليًا" };

const allowed = async () => (await getStudentAccess())?.mutashabihatEnabled === true;

export async function studentSimilarSurahAction(surah: unknown): Promise<Record<number, SimilarGroup[]> | { error: string }> {
  if (!(await allowed())) return OFF;
  return similarForSurah(surah) ?? { error: "سورة غير صحيحة" };
}

export async function studentSimilarVersesAction(keys: unknown): Promise<Record<string, string> | { error: string }> {
  if (!(await allowed())) return OFF;
  return similarVerseTexts(keys) ?? { error: "طلب غير صحيح" };
}
