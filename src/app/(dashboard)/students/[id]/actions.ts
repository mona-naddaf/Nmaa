"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireAdmin, requireSession } from "@/lib/auth/require";
import { issueParentCode } from "@/lib/auth/parent-code";
import {
  advancesPosition,
  calculatePageRange,
  classifyRecitation,
  deriveReach,
  type RecitationSituation,
  type SessionType,
} from "@/lib/recitation/logic";

const SESSION_TYPES: SessionType[] = ["NEW", "REVIEW", "LINK"];
import { todayDateOnly, parseDateOnlyInput } from "@/lib/attendance";
import { resolveTeacherId } from "@/lib/auth/teacher-identity";
import { imperative, thisDemonstrative, pickByGroup, type GroupGender } from "@/lib/text/gender";
import type { Session } from "@/lib/auth/session";
import { wordAt } from "@/lib/quran-data/quran-text";
import { MISTAKE_TYPES, type MistakeType } from "@/lib/students/mistake-types";
import { BONUS_NOTE_MAX_LENGTH } from "@/lib/points/bonus";

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

// In an ASSIGNED-visibility course, a teacher may only act on students in
// the groups assigned to her (when she has any assignments). Every
// per-student action a teacher can take goes through studentAccessError:
// recitation, resolving mistakes, attendance, fixed points and bonus points.
// (The student page itself also redirects, but these server actions can be
// called directly, so each re-checks.)
async function studentAccessError(
  session: Session,
  student: { groupId: string; group: { gender: GroupGender } },
): Promise<string | null> {
  if (session.role !== "teacher") return null;
  const course = await prisma.course.findUniqueOrThrow({ where: { id: session.courseId }, select: { visibilityMode: true } });
  return assignedGroupError(session, student, course);
}

async function assignedGroupError(
  session: Extract<Session, { role: "teacher" }>,
  student: { groupId: string; group: { gender: GroupGender } },
  course: { visibilityMode: string },
): Promise<string | null> {
  if (course.visibilityMode !== "ASSIGNED") return null;
  const assignments = await prisma.teacherGroupAssignment.findMany({ where: { teacherId: session.teacherId } });
  if (assignments.length === 0 || assignments.some((a) => a.groupId === student.groupId)) return null;
  const teacher = await prisma.teacher.findUnique({ where: { id: session.teacherId }, select: { gender: true } });
  return `لا ${imperative(teacher?.gender ?? null, { m: "تملك", f: "تملكين" })} صلاحية الوصول إلى بيانات ${thisDemonstrative(student.group.gender)} ${pickByGroup(student.group.gender, { m: "الطالب", f: "الطالبة" })}`;
}

// a whole long surah is ~6000 words; anything beyond this isn't a real entry
const MAX_MISTAKES_PER_SESSION = 2000;

export interface FlaggedWordInput {
  ayah: number;
  wordPosition: number;
  type: MistakeType;
}

export type SaveRecitationInput = {
  studentId: string;
  surahNumber: number;
  fromAyah: number;
  toAyah: number;
  quality: "EXCELLENT" | "GOOD" | "NEEDS_REPEAT";
  mode: "IN_PERSON" | "ONLINE";
  type: SessionType;
  notes: string;
  reason: string;
  sessionDate: string; // "YYYY-MM-DD", defaults to today but can be backdated
  // words flagged as mistakes, within this surah and ayah range
  mistakes: FlaggedWordInput[];
};

export type SaveRecitationResult = { error: string } | { ok: true };

export async function saveRecitationAction(input: SaveRecitationInput): Promise<SaveRecitationResult> {
  const session = await requireSession();
  const student = await loadStudentForCourse(input.studentId, session.courseId);

  if (session.role === "teacher") {
    const course = await prisma.course.findUniqueOrThrow({ where: { id: session.courseId } });
    const denied = await assignedGroupError(session, student, course);
    if (denied) return { error: denied };
    if (!course.onlineRecitationEnabled && input.mode === "ONLINE") {
      return { error: "التسميع الأونلاين غير مفعّل في هذه الدورة" };
    }
  }

  if (!SESSION_TYPES.includes(input.type)) {
    return { error: "نوع الجلسة غير صحيح" };
  }

  // Only new memorization goes through gap detection (and may need a
  // reason). A review/link revisits covered material by definition: it gets
  // no situation and can never advance her position (deriveReach ignores
  // it), whatever range it names.
  let situation: RecitationSituation | null = null;
  let requiresReason = false;
  if (advancesPosition(input)) {
    const plan = student.planItems.map((pi) => pi.surahNumber);
    const priorSessions = await prisma.recitationSession.findMany({
      where: { studentId: student.id },
      select: { surahNumber: true, fromAyah: true, toAyah: true, type: true, situation: true, reason: true },
    });
    const classification = classifyRecitation(
      plan,
      deriveReach(plan, priorSessions),
      input.surahNumber,
      input.fromAyah,
      student.group.gender,
    );
    situation = classification.situation;
    requiresReason = classification.requiresReason;
    if (requiresReason && !input.reason.trim()) {
      return { error: "يُرجى كتابة سبب هذا التسجيل قبل الحفظ" };
    }
  }

  const pages = calculatePageRange(input.surahNumber, input.fromAyah, input.toAyah);
  if ("error" in pages) {
    return { error: pages.error };
  }

  // flagged words: each must be a real word inside this session's range
  const flagged = Array.isArray(input.mistakes) ? input.mistakes : [];
  if (flagged.length > MAX_MISTAKES_PER_SESSION) return { error: "عدد الكلمات المحدّدة كبير جدًا" };
  const flaggedWords: (FlaggedWordInput & { wordText: string })[] = [];
  const seenWords = new Set<string>();
  for (const m of flagged) {
    const key = `${m?.ayah}:${m?.wordPosition}`;
    const inRange = Number.isInteger(m?.ayah) && m.ayah >= input.fromAyah && m.ayah <= input.toAyah;
    const wordText = inRange && Number.isInteger(m.wordPosition) ? wordAt(input.surahNumber, m.ayah, m.wordPosition) : null;
    if (!wordText || !MISTAKE_TYPES.includes(m.type) || seenWords.has(key)) {
      return { error: "بيانات الكلمات المحدّدة كأخطاء غير صحيحة" };
    }
    seenWords.add(key);
    flaggedWords.push({ ayah: m.ayah, wordPosition: m.wordPosition, type: m.type, wordText });
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
      type: input.type,
      situation,
      reason: requiresReason ? input.reason.trim() : null,
      notes: input.notes.trim() || null,
      occurredAt,
      // same statement as the session, so they're saved together or not at all
      mistakes: {
        createMany: {
          data: flaggedWords.map((m) => ({
            studentId: student.id,
            surahNumber: input.surahNumber,
            ayah: m.ayah,
            wordPosition: m.wordPosition,
            wordText: m.wordText,
            type: m.type,
            teacherId,
            flaggedAt: occurredAt,
          })),
        },
      },
    },
  });

  revalidatePath(`/students/${student.id}`);
  return { ok: true };
}

/**
 * Marks every unresolved flag on one word as resolved — the student no
 * longer makes this mistake. Nothing is deleted: the rows keep their
 * history and just drop off the active lists. Same permission as logging
 * recitation for this student.
 */
export async function resolveMistakeAction(
  studentId: string,
  surahNumber: number,
  ayah: number,
  wordPosition: number,
): Promise<SaveRecitationResult> {
  const session = await requireSession();
  const student = await loadStudentForCourse(studentId, session.courseId);
  const denied = await studentAccessError(session, student);
  if (denied) return { error: denied };

  const teacherId = await resolveTeacherId(session);
  await prisma.recitationMistake.updateMany({
    where: { studentId: student.id, surahNumber, ayah, wordPosition, resolvedAt: null },
    data: { resolvedAt: new Date(), resolvedById: teacherId },
  });

  revalidatePath(`/students/${student.id}`);
  return { ok: true };
}

export async function setAttendanceAction(studentId: string, status: "IN" | "OUT"): Promise<{ error?: string }> {
  const session = await requireSession();
  const student = await loadStudentForCourse(studentId, session.courseId);
  const denied = await studentAccessError(session, student);
  if (denied) return { error: denied };
  const teacherId = await resolveTeacherId(session);
  const day = todayDateOnly();

  await prisma.attendanceLog.upsert({
    where: { studentId_day: { studentId, day } },
    update: { status, teacherId },
    create: { studentId, day, status, teacherId },
  });
  revalidatePath(`/students/${studentId}`);
  return {};
}

export async function togglePointAction(studentId: string, activityId: string, dayInput: string): Promise<{ error?: string }> {
  const session = await requireSession();
  const student = await loadStudentForCourse(studentId, session.courseId);
  const denied = await studentAccessError(session, student);
  if (denied) return { error: denied };

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
  return {};
}

// ---------- Bonus points ----------

export type BonusPointResult = { error: string } | { id: string; note: string; teacherName: string };

/**
 * Adds exactly one bonus point for the given day, with its required note.
 * Each press is its own PointsLog row (no activity), so it has a full trail
 * and every points total picks it up. Same access rule as logging
 * recitation for this student.
 */
export async function addBonusPointAction(studentId: string, dayInput: string, noteInput: string): Promise<BonusPointResult> {
  const session = await requireSession();
  const student = await loadStudentForCourse(studentId, session.courseId);
  const denied = await studentAccessError(session, student);
  if (denied) return { error: denied };

  const note = noteInput.trim();
  if (!note) return { error: "يُرجى كتابة سبب النقطة الإضافية" };
  if (note.length > BONUS_NOTE_MAX_LENGTH) return { error: "السبب طويل جدًا" };
  const day = parseDateOnlyInput(dayInput);
  if (!day) return { error: "تاريخ غير صحيح" };

  const teacherId = await resolveTeacherId(session);
  const row = await prisma.pointsLog.create({
    data: { studentId: student.id, activityId: null, note, teacherId, valueAtTime: 1, typeAtTime: "ADD", day },
    select: { id: true, note: true, teacher: { select: { name: true } } },
  });

  revalidatePath(`/students/${studentId}`);
  return { id: row.id, note: row.note ?? note, teacherName: row.teacher.name };
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
  const issued = await issueParentCode(id);
  if (!issued) return { error: "تعذّر إنشاء الكود، يُرجى المحاولة مرة أخرى" };
  revalidatePath(`/students/${id}`);
  return { code: issued.code, createdAt: issued.createdAt.toISOString() };
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
