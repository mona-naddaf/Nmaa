"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth/require";
import { issueMissingStudentCodes } from "@/lib/auth/student-code";
import { studentCodeAccess } from "@/lib/students/student-codes";

// Same rules as the per-student actions: supervisor, or a permitted teacher
// for her own groups only. Skips students with a code and revoked codes.
export async function generateMissingStudentCodesAction(): Promise<{ created: number } | { error: string }> {
  const session = await requireSession();
  const access = await studentCodeAccess(session);
  if (!access.allowed) return { error: "ليست لديك صلاحية إصدار رموز الطلاب" };
  const result = await issueMissingStudentCodes(session.courseId, access.groupIds);
  revalidatePath("/students/student-codes");
  if (result.failed) {
    return { error: `حدث خطأ بعد إنشاء ${result.created} من ${result.needed} — يُرجى المحاولة مرة أخرى لإكمال البقية` };
  }
  return { created: result.created };
}
