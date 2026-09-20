"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth/require";
import { calculatePageRange, classifyRecitation, deriveFurthestPosition } from "@/lib/recitation/logic";
import { todayDateOnly } from "@/lib/attendance";
import { resolveTeacherId } from "@/lib/auth/teacher-identity";

async function loadStudentForCourse(studentId: string, courseId: string) {
  const student = await prisma.student.findFirst({
    where: { id: studentId, courseId },
    include: { planItems: { orderBy: { position: "asc" } } },
  });
  if (!student) throw new Error("طالبة غير موجودة");
  return student;
}

export type SaveRecitationInput = {
  studentId: string;
  surahNumber: number;
  fromAyah: number;
  toAyah: number;
  quality: "EXCELLENT" | "GOOD" | "NEEDS_REPEAT";
  mode: "IN_PERSON" | "ONLINE";
  notes: string;
  reason: string;
};

export type SaveRecitationResult = { error: string } | { ok: true };

export async function saveRecitationAction(input: SaveRecitationInput): Promise<SaveRecitationResult> {
  const session = await requireSession();
  const student = await loadStudentForCourse(input.studentId, session.courseId);

  if (session.role === "teacher") {
    const course = await prisma.course.findUniqueOrThrow({ where: { id: session.courseId } });
    if (course.visibilityMode === "ASSIGNED") {
      const assignments = await prisma.teacherGroupAssignment.findMany({ where: { teacherId: session.teacherId } });
      if (assignments.length > 0 && !assignments.some((a) => a.groupId === student.groupId)) {
        return { error: "لا تملكين صلاحية الوصول إلى بيانات هذه الطالبة" };
      }
    }
    if (!course.onlineRecitationEnabled && input.mode === "ONLINE") {
      return { error: "التسميع الأونلاين غير مفعّل في هذه الدورة" };
    }
  }

  const plan = student.planItems.map((pi) => pi.surahNumber);
  const priorSessions = await prisma.recitationSession.findMany({
    where: { studentId: student.id },
    select: { surahNumber: true, toAyah: true },
  });
  const furthest = deriveFurthestPosition(plan, priorSessions);

  const classification = classifyRecitation(plan, furthest, input.surahNumber, input.fromAyah);
  if (classification.requiresReason && !input.reason.trim()) {
    return { error: "يُرجى كتابة سبب هذا التسجيل قبل الحفظ" };
  }

  const pages = calculatePageRange(input.surahNumber, input.fromAyah, input.toAyah);
  if ("error" in pages) {
    return { error: pages.error };
  }

  const teacherId = await resolveTeacherId(session);

  await prisma.recitationSession.create({
    data: {
      studentId: student.id,
      teacherId,
      surahNumber: input.surahNumber,
      fromAyah: input.fromAyah,
      toAyah: input.toAyah,
      pagesCalculated: pages.totalPages,
      quality: input.quality,
      mode: input.mode,
      situation: classification.situation,
      reason: classification.requiresReason ? input.reason.trim() : null,
      notes: input.notes.trim() || null,
    },
  });

  revalidatePath(`/students/${student.id}`);
  return { ok: true };
}

export async function setAttendanceAction(studentId: string, status: "IN" | "OUT") {
  const session = await requireSession();
  await loadStudentForCourse(studentId, session.courseId);
  await prisma.student.update({
    where: { id: studentId },
    data: { attendanceStatus: status, attendanceDay: todayDateOnly() },
  });
  revalidatePath(`/students/${studentId}`);
}

export async function togglePointAction(studentId: string, activityId: string) {
  const session = await requireSession();
  const student = await loadStudentForCourse(studentId, session.courseId);

  const activity = await prisma.pointsActivity.findFirst({
    where: { id: activityId, courseId: session.courseId },
  });
  if (!activity) throw new Error("نشاط غير موجود");

  const teacherId = await resolveTeacherId(session);

  const day = todayDateOnly();
  const existing = await prisma.pointsLog.findUnique({
    where: { studentId_activityId_day: { studentId: student.id, activityId, day } },
  });

  if (existing) {
    await prisma.pointsLog.delete({ where: { id: existing.id } });
  } else {
    await prisma.pointsLog.create({
      data: {
        studentId: student.id,
        activityId,
        teacherId,
        valueAtTime: activity.value,
        typeAtTime: activity.type,
        day,
      },
    });
  }

  revalidatePath(`/students/${studentId}`);
}
