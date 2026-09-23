"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireAdmin, requireSession } from "@/lib/auth/require";
import { generateUniqueParentCode } from "@/lib/auth/parent-code";
import { calculatePageRange, classifyRecitation, deriveFurthestPosition } from "@/lib/recitation/logic";
import { todayDateOnly, parseDateOnlyInput } from "@/lib/attendance";
import { resolveTeacherId } from "@/lib/auth/teacher-identity";
import { imperative, thisDemonstrative, pickByGroup } from "@/lib/text/gender";

function addHoursUTC(date: Date, hours: number): Date {
  return new Date(date.getTime() + hours * 60 * 60 * 1000);
}

async function loadStudentForCourse(studentId: string, courseId: string) {
  const student = await prisma.student.findFirst({
    where: { id: studentId, courseId },
    include: { planItems: { orderBy: { position: "asc" } }, group: { select: { gender: true } } },
  });
  if (!student) throw new Error("طالب غير موجود");
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
  sessionDate: string; // "YYYY-MM-DD", defaults to today but can be backdated
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
        const teacher = await prisma.teacher.findUnique({ where: { id: session.teacherId }, select: { gender: true } });
        return {
          error: `لا ${imperative(teacher?.gender ?? null, { m: "تملك", f: "تملكين" })} صلاحية الوصول إلى بيانات ${thisDemonstrative(student.group.gender)} ${pickByGroup(student.group.gender, { m: "الطالب", f: "الطالبة" })}`,
        };
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

  const classification = classifyRecitation(plan, furthest, input.surahNumber, input.fromAyah, student.group.gender);
  if (classification.requiresReason && !input.reason.trim()) {
    return { error: "يُرجى كتابة سبب هذا التسجيل قبل الحفظ" };
  }

  const pages = calculatePageRange(input.surahNumber, input.fromAyah, input.toAyah);
  if ("error" in pages) {
    return { error: pages.error };
  }

  const sessionDay = parseDateOnlyInput(input.sessionDate);
  if (!sessionDay) {
    return { error: "تاريخ الجلسة غير صحيح — لا يمكن أن يكون في المستقبل" };
  }
  // today keeps full time-of-day precision for correct same-day ordering;
  // a backdated entry is pinned to noon of the chosen day
  const occurredAt = sessionDay.getTime() === todayDateOnly().getTime() ? new Date() : addHoursUTC(sessionDay, 12);

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
      occurredAt,
    },
  });

  revalidatePath(`/students/${student.id}`);
  return { ok: true };
}

export async function setAttendanceAction(studentId: string, status: "IN" | "OUT") {
  const session = await requireSession();
  await loadStudentForCourse(studentId, session.courseId);
  const teacherId = await resolveTeacherId(session);
  const day = todayDateOnly();

  await prisma.attendanceLog.upsert({
    where: { studentId_day: { studentId, day } },
    update: { status, teacherId },
    create: { studentId, day, status, teacherId },
  });
  revalidatePath(`/students/${studentId}`);
}

export async function togglePointAction(studentId: string, activityId: string, dayInput: string) {
  const session = await requireSession();
  const student = await loadStudentForCourse(studentId, session.courseId);

  const activity = await prisma.pointsActivity.findFirst({
    where: { id: activityId, courseId: session.courseId },
  });
  if (!activity) throw new Error("نشاط غير موجود");

  const day = parseDateOnlyInput(dayInput);
  if (!day) throw new Error("تاريخ غير صحيح");

  const teacherId = await resolveTeacherId(session);

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

// ---------- Parent access (supervisor only) ----------

export type ParentAccessResult = { error: string } | { code: string | null; createdAt: string | null };

async function adminStudentId(studentId: string) {
  const session = await requireAdmin();
  const student = await prisma.student.findFirst({ where: { id: studentId, courseId: session.courseId }, select: { id: true } });
  if (!student) throw new Error("طالب غير موجود");
  return student.id;
}

// Issues a fresh code. Bumping parentCodeVersion invalidates every session
// opened with a previous code, so this doubles as "revoke and replace".
export async function regenerateParentCodeAction(studentId: string): Promise<ParentAccessResult> {
  const id = await adminStudentId(studentId);
  const code = await generateUniqueParentCode();
  const updated = await prisma.student.update({
    where: { id },
    data: { parentCode: code, parentCodeVersion: { increment: 1 }, parentCodeCreatedAt: new Date() },
    select: { parentCode: true, parentCodeCreatedAt: true },
  });
  revalidatePath(`/students/${id}`);
  return { code: updated.parentCode, createdAt: updated.parentCodeCreatedAt?.toISOString() ?? null };
}

export async function revokeParentCodeAction(studentId: string): Promise<ParentAccessResult> {
  const id = await adminStudentId(studentId);
  await prisma.student.update({
    where: { id },
    data: { parentCode: null, parentCodeVersion: { increment: 1 }, parentCodeCreatedAt: null },
  });
  revalidatePath(`/students/${id}`);
  return { code: null, createdAt: null };
}
