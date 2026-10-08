"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getStudentAccess } from "@/lib/auth/student-session";
import { effectiveTargets } from "@/lib/home-log/data";
import { acceptLocalDay, HOME_LIMITS, HOME_TAP_KINDS, validateRange, type HomeTapKind } from "@/lib/home-log/rules";
import { checkMark, resolveHomeMark, setHomeMark, type MarkInput } from "@/lib/home-log/self-marks";

// The student's own home log. Every action re-checks her session, that the
// course has the home log on, and that the segment is hers. Nothing here
// touches RecitationSession — the official position never moves from it.

export type HomeResult = { error?: string; id?: string };

const OFF = { error: "حفظي في البيت غير متاح حاليًا" };

async function homeStudent() {
  const access = await getStudentAccess();
  if (!access || !access.homeLogEnabled) return null;
  return access.studentId;
}

async function ownActiveSegment(studentId: string, segmentId: string) {
  return prisma.homeSegment.findFirst({
    where: { id: String(segmentId ?? ""), studentId, finishedAt: null },
    select: { id: true, fromAyah: true, toAyah: true },
  });
}

function refresh() {
  revalidatePath("/student/home-log", "layout");
}

export async function createSegmentAction(input: { surahNumber: number; fromAyah: number; toAyah: number }): Promise<HomeResult> {
  const studentId = await homeStudent();
  if (!studentId) return OFF;
  const surahNumber = Number(input?.surahNumber);
  const fromAyah = Number(input?.fromAyah);
  const toAyah = Number(input?.toAyah);
  const bad = validateRange(surahNumber, fromAyah, toAyah);
  if (bad) return { error: bad };

  const [active, today] = await Promise.all([
    // D4: «واجب» segments (set by a teacher) don't count toward her limit
    prisma.homeSegment.count({ where: { studentId, finishedAt: null, assignmentId: null } }),
    prisma.homeSegment.count({ where: { studentId, assignmentId: null, createdAt: { gt: new Date(Date.now() - 24 * 60 * 60 * 1000) } } }),
  ]);
  if (active >= HOME_LIMITS.maxActiveSegments) {
    return { error: `يمكن أن تكون ${HOME_LIMITS.maxActiveSegments} مقاطع على الأكثر قيد الحفظ في وقت واحد — يُرجى إتمام أحدها أولًا` };
  }
  if (today >= HOME_LIMITS.segmentsPerDay) return { error: "تم بلوغ الحدّ اليومي لإضافة المقاطع، ويمكن الإضافة مجددًا غدًا" };

  const t = await effectiveTargets(studentId);
  const segment = await prisma.homeSegment.create({
    data: { studentId, surahNumber, fromAyah, toAyah, targetListen: t.listen, targetRepeat: t.repeat, targetRecite: t.recite },
    select: { id: true },
  });
  refresh();
  return { id: segment.id };
}

/** One "+" tap: a whole-segment counter (ayah null) or one ayah's counter. */
export async function tapAction(input: { segmentId: string; ayah: number | null; kind: HomeTapKind; day: string }): Promise<HomeResult> {
  const studentId = await homeStudent();
  if (!studentId) return OFF;
  const kind = input?.kind;
  if (!HOME_TAP_KINDS.includes(kind)) return { error: "نوع غير صحيح" };
  const day = acceptLocalDay(input?.day);
  if (!day) return { error: "تاريخ غير صحيح — يُرجى تحديث الصفحة" };
  const segment = await ownActiveSegment(studentId, input?.segmentId);
  if (!segment) return { error: "هذا المقطع غير متاح للتسجيل" };
  const ayah = input?.ayah ?? null;
  if (ayah !== null && (!Number.isInteger(ayah) || ayah < segment.fromAyah || ayah > segment.toAyah)) {
    return { error: "آية خارج المقطع" };
  }
  const recent = await prisma.homeTap.count({ where: { studentId, createdAt: { gt: new Date(Date.now() - 60 * 1000) } } });
  if (recent >= HOME_LIMITS.tapsPerMinute) return { error: "ضغطات كثيرة في وقت قصير — يُرجى التمهّل قليلًا" };

  await prisma.homeTap.create({ data: { segmentId: segment.id, studentId, ayah, kind, day: new Date(`${day}T00:00:00Z`) } });
  return {};
}

/** D6: removes her most recent tap of that counter from today only. */
export async function undoTapAction(input: { segmentId: string; ayah: number | null; kind: HomeTapKind; day: string }): Promise<HomeResult> {
  const studentId = await homeStudent();
  if (!studentId) return OFF;
  if (!HOME_TAP_KINDS.includes(input?.kind)) return { error: "نوع غير صحيح" };
  const day = acceptLocalDay(input?.day);
  if (!day) return { error: "تاريخ غير صحيح — يُرجى تحديث الصفحة" };
  const segment = await ownActiveSegment(studentId, input?.segmentId);
  if (!segment) return { error: "هذا المقطع غير متاح للتسجيل" };
  const last = await prisma.homeTap.findFirst({
    where: { segmentId: segment.id, studentId, ayah: input?.ayah ?? null, kind: input.kind, day: new Date(`${day}T00:00:00Z`) },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });
  if (!last) return { error: "لا يوجد ما يمكن التراجع عنه اليوم" };
  await prisma.homeTap.delete({ where: { id: last.id } });
  return {};
}

export async function finishSegmentAction(segmentId: string): Promise<HomeResult> {
  const studentId = await homeStudent();
  if (!studentId) return OFF;
  const { count } = await prisma.homeSegment.updateMany({
    where: { id: String(segmentId ?? ""), studentId, finishedAt: null },
    data: { finishedAt: new Date(), finishedBy: "STUDENT" },
  });
  if (count === 0) return { error: "هذا المقطع غير متاح" };
  refresh();
  return {};
}

/** D7: only a segment with no taps yet (a mistaken range) can be deleted. */
export async function deleteSegmentAction(segmentId: string): Promise<HomeResult> {
  const studentId = await homeStudent();
  if (!studentId) return OFF;
  const segment = await prisma.homeSegment.findFirst({
    where: { id: String(segmentId ?? ""), studentId },
    select: { id: true, assignmentId: true, _count: { select: { taps: true } } },
  });
  if (!segment) return { error: "هذا المقطع غير متاح" };
  if (segment.assignmentId) return { error: "هذا المقطع واجب من المعلم، ولا يمكن حذفه — يمكن إتمامه بدلًا من ذلك" };
  if (segment._count.taps > 0) return { error: "لا يمكن حذف مقطع سُجّل فيه تدريب — يمكن إتمامه بدلًا من ذلك" };
  await prisma.homeSegment.delete({ where: { id: segment.id } });
  refresh();
  return {};
}

// ---------- her own marked mistakes (private to her) ----------

const MARKS_OFF = { error: "تحديد الأخطاء في حفظ البيت غير متاح حاليًا" };

async function markingStudent() {
  const access = await getStudentAccess();
  return access?.homeMistakesEnabled ? access.studentId : null;
}

/** Marks, re-types or removes (type null) one word of an active passage of hers. */
export async function markHomeWordAction(input: MarkInput): Promise<HomeResult> {
  const studentId = await markingStudent();
  if (!studentId) return MARKS_OFF;
  const segment = await prisma.homeSegment.findFirst({
    where: { id: String(input?.segmentId ?? ""), studentId, finishedAt: null },
    select: { surahNumber: true, fromAyah: true, toAyah: true },
  });
  if (!segment) return { error: "هذا المقطع غير متاح" };
  const mark = checkMark(segment, input);
  if ("error" in mark) return { error: mark.error };
  return setHomeMark(studentId, segment.surahNumber, mark);
}

export async function resolveHomeWordAction(surahNumber: number, ayah: number, wordPosition: number): Promise<{ error: string } | { ok: true }> {
  const studentId = await markingStudent();
  if (!studentId) return { error: MARKS_OFF.error };
  const done = await resolveHomeMark(studentId, Number(surahNumber), Number(ayah), Number(wordPosition));
  if (!done) return { error: "هذه الكلمة غير موجودة في قائمتك" };
  refresh();
  return { ok: true };
}
