"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/require";
import { issueMissingParentCodes } from "@/lib/auth/parent-code";

// Supervisor-only, like the per-student code actions. Skips students who
// already have a code and students whose code was revoked (see
// issueMissingParentCodes).
export async function generateMissingParentCodesAction(): Promise<{ created: number } | { error: string }> {
  const session = await requireAdmin();
  const result = await issueMissingParentCodes(session.courseId);
  revalidatePath("/students/parent-codes");
  if (result.failed) {
    return { error: `حدث خطأ بعد إنشاء ${result.created} من ${result.needed} — يُرجى المحاولة مرة أخرى لإكمال البقية` };
  }
  return { created: result.created };
}
