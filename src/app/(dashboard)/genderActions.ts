"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth/require";
import { syncSupervisorProxyName } from "@/lib/auth/teacher-identity";

// Records the current teacher's/admin's own gender (or that they chose to
// skip) so the one-time prompt never shows again for them. `gender: null`
// means "skipped" — future UI text about them falls back to the masculine
// default, same as if they'd never been asked.
export async function setPersonGenderAction(gender: "MALE" | "FEMALE" | null) {
  const session = await requireSession();

  if (session.role === "admin") {
    await prisma.admin.update({
      where: { id: session.adminId },
      data: { gender, genderPrompted: true },
    });
    // past supervisor entries display as مشرف/مشرفة الدورة: follow the new gender
    await syncSupervisorProxyName(session.courseId, gender);
  } else {
    await prisma.teacher.update({
      where: { id: session.teacherId },
      data: { gender, genderPrompted: true },
    });
  }

  revalidatePath("/", "layout");
}
