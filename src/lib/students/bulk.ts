import "server-only";
import type { JWTPayload } from "jose";
import { prisma } from "@/lib/db";
import type { Session } from "@/lib/auth/session";
import { resolveTeacherId } from "@/lib/auth/teacher-identity";
import { createScopedToken } from "@/lib/auth/scoped-token";
import { attendanceDay } from "@/lib/attendance";
import { BONUS_NOTE_MAX_LENGTH } from "@/lib/points/bonus";

// The students page's «تحديد» bar (students/bulk-actions.ts): today's
// attendance or a point for many students at once. Exactly what recording
// them one by one does (same rows, same permission: staff, a teacher only
// for the students she can see), all checked here: every id must be an
// active student of this course visible to her, or nothing is saved. Each
// action returns a signed «تراجع» token (60 seconds, same user only) that
// undoes exactly that action — never touching a record someone changed
// since. Each returns the students it touched, for the caller to refresh.

// a fixed reason for a bonus point given in bulk without one (the database
// requires a reason on every bonus point)
const BULK_BONUS_NOTE = "نقطة إضافية (تسجيل جماعي)";
const MAX_STUDENTS = 500;

type Denied = { error: string };

async function selectedStudents(session: Session, rawIds: unknown): Promise<Denied | { ids: string[] }> {
  const ids = [...new Set(Array.isArray(rawIds) ? rawIds.map(String) : [])];
  if (ids.length === 0) return { error: "لم يُحدَّد أحد" };
  if (ids.length > MAX_STUDENTS) return { error: "عدد المحدَّدين كبير جدًا" };
  const students = await prisma.student.findMany({
    where: { id: { in: ids }, courseId: session.courseId, archivedAt: null },
    select: { id: true, groupId: true },
  });
  if (students.length !== ids.length) {
    return { error: "بعض المحدَّدين لم يعودوا متاحين (نُقلوا إلى الأرشيف أو حُذفوا). يُرجى تحديث الصفحة." };
  }
  if (session.role === "teacher") {
    const course = await prisma.course.findUniqueOrThrow({ where: { id: session.courseId }, select: { visibilityMode: true } });
    if (course.visibilityMode === "ASSIGNED") {
      const groups = (await prisma.teacherGroupAssignment.findMany({ where: { teacherId: session.teacherId }, select: { groupId: true } })).map((a) => a.groupId);
      if (groups.length > 0 && students.some((s) => !groups.includes(s.groupId))) {
        return { error: "ليست لديك صلاحية على بعض المحدَّدين" };
      }
    }
  }
  return { ids };
}

// ---------- «تراجع» ----------

type UndoData =
  | { kind: "attendance"; day: string; status: "IN" | "OUT"; teacherId: string; prev: [string, "IN" | "OUT" | null, string | null][] }
  | { kind: "points"; ids: string[] };

const undoTokens = createScopedToken<{ u: string; c: string; d: string }>({
  scope: "bulk-undo",
  ttl: "60s",
  isPayload: (p: JWTPayload) => typeof p.u === "string" && typeof p.c === "string" && typeof p.d === "string",
});

const userKey = (s: Session) => (s.role === "admin" ? `a:${s.adminId}` : `t:${s.teacherId}`);
const signUndo = (session: Session, data: UndoData) => undoTokens.sign({ u: userKey(session), c: session.courseId, d: JSON.stringify(data) });

// ---------- attendance ----------

export type BulkResult = Denied | { ok: true; done: number; skipped: number; undo: string; touched?: string[] };

/** Today's attendance (Riyadh) for every selected student; an existing record is overwritten. */
export async function bulkAttendance(session: Session, studentIds: unknown, status: unknown): Promise<BulkResult> {
  if (status !== "IN" && status !== "OUT") return { error: "حالة الحضور غير صحيحة" };
  const picked = await selectedStudents(session, studentIds);
  if ("error" in picked) return picked;
  const teacherId = await resolveTeacherId(session);
  const day = attendanceDay();

  const prev = await prisma.$transaction(async (tx) => {
    const before = await tx.attendanceLog.findMany({
      where: { studentId: { in: picked.ids }, day },
      select: { studentId: true, status: true, teacherId: true },
    });
    for (const studentId of picked.ids) {
      await tx.attendanceLog.upsert({
        where: { studentId_day: { studentId, day } },
        update: { status, teacherId },
        create: { studentId, day, status, teacherId },
      });
    }
    return picked.ids.map((id): [string, "IN" | "OUT" | null, string | null] => {
      const b = before.find((x) => x.studentId === id);
      return [id, b && b.status !== "PENDING" ? b.status : null, b?.teacherId ?? null];
    });
  });

  const undo = await signUndo(session, { kind: "attendance", day: day.toISOString().slice(0, 10), status, teacherId, prev });
  return { ok: true, done: picked.ids.length, skipped: 0, undo, touched: picked.ids };
}

// ---------- points ----------

/**
 * A point category of this course for every selected student (skipping
 * those who already have it today), or — activityId null — one bonus point
 * each, with the typed reason or a fixed one.
 */
export async function bulkPoint(session: Session, studentIds: unknown, activityId: unknown, noteInput: unknown): Promise<BulkResult> {
  const picked = await selectedStudents(session, studentIds);
  if ("error" in picked) return picked;
  const teacherId = await resolveTeacherId(session);
  const day = attendanceDay();

  let created: { id: string }[];
  let skipped = 0;
  if (activityId === null) {
    const note = String(noteInput ?? "").trim() || BULK_BONUS_NOTE;
    if (note.length > BONUS_NOTE_MAX_LENGTH) return { error: "السبب طويل جدًا" };
    created = await prisma.pointsLog.createManyAndReturn({
      data: picked.ids.map((studentId) => ({ studentId, activityId: null, note, teacherId, valueAtTime: 1, typeAtTime: "ADD" as const, day })),
      select: { id: true },
    });
  } else {
    const activity = await prisma.pointsActivity.findFirst({ where: { id: String(activityId), courseId: session.courseId } });
    if (!activity) return { error: "هذا البند غير موجود في إعدادات النقاط" };
    created = await prisma.$transaction(async (tx) => {
      const already = new Set(
        (await tx.pointsLog.findMany({ where: { studentId: { in: picked.ids }, activityId: activity.id, day }, select: { studentId: true } })).map(
          (r) => r.studentId,
        ),
      );
      skipped = already.size;
      return tx.pointsLog.createManyAndReturn({
        data: picked.ids
          .filter((id) => !already.has(id))
          .map((studentId) => ({ studentId, activityId: activity.id, teacherId, valueAtTime: activity.value, typeAtTime: activity.type, day })),
        // a point given meanwhile (same student, category and day) is skipped too
        skipDuplicates: true,
        select: { id: true },
      });
    });
    skipped = picked.ids.length - created.length;
  }

  const undo = await signUndo(session, { kind: "points", ids: created.map((r) => r.id) });
  return { ok: true, done: created.length, skipped, undo, touched: picked.ids };
}

// ---------- undo ----------

export type UndoResult = Denied | { ok: true; undone: number; kept: number; touched?: string[] };

export async function undoBulk(session: Session, token: unknown): Promise<UndoResult> {
  const payload = typeof token === "string" ? await undoTokens.verify(token) : null;
  if (!payload || payload.u !== userKey(session) || payload.c !== session.courseId) {
    return { error: "انتهت مهلة التراجع" };
  }
  const data = JSON.parse(payload.d) as UndoData;

  if (data.kind === "points") {
    const rows = await prisma.pointsLog.findMany({ where: { id: { in: data.ids } }, select: { id: true, studentId: true } });
    const picked = await selectedStudents(session, [...new Set(rows.map((r) => r.studentId))]);
    if (rows.length > 0 && "error" in picked) return picked;
    const { count } = await prisma.pointsLog.deleteMany({ where: { id: { in: rows.map((r) => r.id) }, student: { courseId: session.courseId } } });
    // a point removed by someone else meanwhile is already gone
    return { ok: true, undone: count, kept: 0, touched: [...new Set(rows.map((r) => r.studentId))] };
  }

  const day = new Date(`${data.day}T00:00:00Z`);
  const ids = data.prev.map(([id]) => id);
  const picked = await selectedStudents(session, ids);
  if ("error" in picked) return picked;
  let undone = 0;
  let kept = 0;
  await prisma.$transaction(async (tx) => {
    const now = await tx.attendanceLog.findMany({ where: { studentId: { in: ids }, day }, select: { studentId: true, status: true, teacherId: true } });
    for (const [studentId, prevStatus, prevTeacher] of data.prev) {
      const cur = now.find((r) => r.studentId === studentId);
      // changed by someone (or again) since: left as it is
      if (!cur || cur.status !== data.status || cur.teacherId !== data.teacherId) {
        kept++;
        continue;
      }
      if (prevStatus === null) await tx.attendanceLog.delete({ where: { studentId_day: { studentId, day } } });
      else await tx.attendanceLog.update({ where: { studentId_day: { studentId, day } }, data: { status: prevStatus, teacherId: prevTeacher! } });
      undone++;
    }
  });
  return { ok: true, undone, kept, touched: ids };
}
