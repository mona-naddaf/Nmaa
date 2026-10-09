"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth/require";
import type { Session } from "@/lib/auth/session";
import { resolveTeacherId } from "@/lib/auth/teacher-identity";
import { deriveReach } from "@/lib/recitation/logic";
import { canAddPrior, teacherGroupLimit } from "@/lib/students/manage";
import { priorOverlapProblem, priorProblem, priorSessionRows, type PriorPartial } from "@/lib/students/new-student";
import { pickByGroup, studentNounDef, type GroupGender } from "@/lib/text/gender";

// «إضافة حفظ سابق» on an existing student: the same PRIOR baseline rows as
// prior memorization entered when she was added (priorSessionRows), so
// position, coverage and progress bars treat them alike, while the
// leaderboard, reports and streaks (LOGGED only) never see them. Points and
// attendance are separate records and untouched.
//
// Who: the supervisor; a teacher with «إضافة حفظ سابق» and only for a
// student she can see. Never an archived student. Deleting is limited to
// PRIOR rows — a logged recitation can't be deleted here.

export type PriorResult = { error: string } | { ok: true };

const DENIED = "ليست لديك صلاحية إضافة حفظ سابق";

/** The student (active, this course, visible to her) and her plan — or an error. */
type PriorStudent = { id: string; groupId: string; group: { gender: GroupGender } };

async function priorAccess(
  session: Session,
  studentId: unknown,
): Promise<{ error: string } | { student: PriorStudent; plan: number[] }> {
  const course = await prisma.course.findUniqueOrThrow({
    where: { id: session.courseId },
    select: { addPriorPermission: true, visibilityMode: true },
  });
  if (!canAddPrior(session, course)) return { error: DENIED };
  const student = await prisma.student.findFirst({
    where: { id: String(studentId ?? ""), courseId: session.courseId },
    select: {
      id: true,
      groupId: true,
      archivedAt: true,
      group: { select: { gender: true } },
      planItems: { orderBy: { position: "asc" }, select: { surahNumber: true } },
    },
  });
  if (!student) return { error: "غير موجود في هذه الدورة" };
  if (student.archivedAt) {
    const g = student.group.gender;
    return { error: `${studentNounDef(g)} في الأرشيف، فلا يمكن تعديل ${pickByGroup(g, { m: "حفظه", f: "حفظها" })} السابق` };
  }
  const limit = await teacherGroupLimit(session, course);
  if (limit && !limit.includes(student.groupId)) {
    return { error: `ليست لديك صلاحية على ${pickByGroup(student.group.gender, { m: "هذا", f: "هذه" })} ${studentNounDef(student.group.gender)}` };
  }
  return { student, plan: student.planItems.map((p) => p.surahNumber) };
}

function cleanPrior(raw: unknown): { completed: number[]; partial: PriorPartial | null } | null {
  const r = raw as { completedSurahs?: unknown; partial?: unknown } | null;
  const completed = Array.isArray(r?.completedSurahs) ? r.completedSurahs.map(Number) : [];
  const p = r?.partial as PriorPartial | null | undefined;
  const partial = p ? { surahNumber: Number(p.surahNumber), fromAyah: Number(p.fromAyah), toAyah: Number(p.toAyah) } : null;
  if (completed.some((n) => !Number.isInteger(n))) return null;
  if (partial && ![partial.surahNumber, partial.fromAyah, partial.toAyah].every(Number.isInteger)) return null;
  return { completed, partial };
}

export async function addStudentPriorAction(studentId: string, input: unknown): Promise<PriorResult> {
  const session = await requireSession();
  const access = await priorAccess(session, studentId);
  if ("error" in access) return { error: access.error };
  const { student, plan } = access;

  const prior = cleanPrior(input);
  if (!prior) return { error: "بيانات الحفظ السابق غير صحيحة" };
  if (prior.completed.length === 0 && !prior.partial) return { error: "يُرجى تحديد سورة واحدة على الأقل" };

  const sessions = await prisma.recitationSession.findMany({
    where: { studentId: student.id },
    select: { surahNumber: true, fromAyah: true, toAyah: true, type: true, situation: true, reason: true },
  });
  const problem =
    priorProblem(plan, prior.completed, prior.partial, `خطة ${studentNounDef(student.group.gender)}`) ??
    priorOverlapProblem(deriveReach(plan, sessions).covered, prior.completed, prior.partial);
  if (problem) return { error: problem };

  const teacherId = await resolveTeacherId(session);
  await prisma.recitationSession.createMany({
    data: priorSessionRows(prior.completed, prior.partial, teacherId).map((row) => ({ ...row, studentId: student.id })),
  });

  revalidatePath(`/students/${student.id}`);
  return { ok: true };
}

export async function deleteStudentPriorAction(studentId: string, sessionId: string): Promise<PriorResult> {
  const session = await requireSession();
  const access = await priorAccess(session, studentId);
  if ("error" in access) return { error: access.error };

  const { count } = await prisma.recitationSession.deleteMany({
    where: { id: String(sessionId ?? ""), studentId: access.student.id, source: "PRIOR" },
  });
  if (count === 0) return { error: "هذا الإدخال غير موجود أو ليس حفظًا سابقًا" };

  revalidatePath(`/students/${access.student.id}`);
  return { ok: true };
}
