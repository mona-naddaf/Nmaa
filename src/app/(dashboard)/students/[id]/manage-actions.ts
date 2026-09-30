"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth/require";
import { MAX_AGE, MAX_GRADE_LENGTH, MIN_AGE, studentNameKey } from "@/lib/students/new-student";
import {
  ACTIVE_STUDENT,
  canArchiveStudents,
  canEditStudents,
  duplicateNameMessage,
  studentNameTaken,
  teacherGroupLimit,
} from "@/lib/students/manage";
import { studentNounDef, studentsNoun } from "@/lib/text/gender";

export type ManageResult = { error?: string };

// Loads an active student of the session's course the viewer may act on
// under the assigned-groups rule, or explains why not.
async function manageContext(studentId: string) {
  const session = await requireSession();
  const course = await prisma.course.findUniqueOrThrow({
    where: { id: session.courseId },
    select: { editStudentsPermission: true, archiveStudentsPermission: true, visibilityMode: true },
  });
  const student = await prisma.student.findFirst({
    where: { id: studentId, courseId: session.courseId, ...ACTIVE_STUDENT },
    select: { id: true, name: true, groupId: true, group: { select: { gender: true } } },
  });
  if (!student) return { error: "لم يُعثر على هذا السجل" } as const;
  const limit = await teacherGroupLimit(session, course);
  if (limit && !limit.includes(student.groupId)) {
    return { error: `لا يمكنك التعديل على ${studentsNoun(student.group.gender)} خارج مجموعاتك` } as const;
  }
  return { session, course, student, limit } as const;
}

function refreshStudentViews(studentId: string) {
  revalidatePath("/students", "layout");
  revalidatePath(`/students/${studentId}`);
  revalidatePath("/leaderboard");
  revalidatePath("/reports");
}

export type StudentEditInput = { name: string; age: number; grade: string; groupId: string };

export async function updateStudentAction(studentId: string, input: StudentEditInput): Promise<ManageResult> {
  const ctx = await manageContext(studentId);
  if ("error" in ctx) return { error: ctx.error };
  const { session, course, student, limit } = ctx;
  if (!canEditStudents(session, course)) return { error: "ليست لديك صلاحية تعديل بيانات الطلاب" };

  const group = await prisma.group.findFirst({
    where: { id: String(input.groupId ?? ""), courseId: session.courseId },
    select: { id: true, gender: true },
  });
  if (!group) return { error: "المجموعة غير موجودة" };
  if (limit && !limit.includes(group.id)) return { error: "لا يمكن النقل إلا إلى إحدى مجموعاتك" };

  const name = String(input.name ?? "").trim();
  const grade = String(input.grade ?? "").trim();
  const age = Number(input.age);
  if (!name) return { error: `يُرجى إدخال اسم ${studentNounDef(group.gender)}` };
  if (!Number.isInteger(age) || age < MIN_AGE || age > MAX_AGE) return { error: "يُرجى إدخال عمر صحيح" };
  if (grade.length > MAX_GRADE_LENGTH) return { error: "الصف طويل جدًا" };
  // only a changed name is checked, so an older duplicate never blocks other edits
  if (studentNameKey(name) !== studentNameKey(student.name) && (await studentNameTaken(session.courseId, name, student.id))) {
    return { error: duplicateNameMessage(group.gender) };
  }

  await prisma.student.update({
    where: { id: student.id },
    data: { name, age, grade: grade || null, groupId: group.id },
  });
  refreshStudentViews(student.id);
  return {};
}

export async function archiveStudentAction(studentId: string, keepInReports: boolean): Promise<ManageResult> {
  const ctx = await manageContext(studentId);
  if ("error" in ctx) return { error: ctx.error };
  const { session, course, student } = ctx;
  if (!canArchiveStudents(session, course)) return { error: "ليست لديك صلاحية أرشفة الطلاب" };

  await prisma.student.update({
    where: { id: student.id },
    data: { archivedAt: new Date(), keepInReports: keepInReports !== false },
  });
  refreshStudentViews(student.id);
  revalidatePath("/students/parent-codes");
  return {};
}
