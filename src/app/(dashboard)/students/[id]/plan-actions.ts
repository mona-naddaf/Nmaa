"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth/require";
import type { Session } from "@/lib/auth/session";
import { juzHasDirection, type JuzDirection } from "@/lib/recitation/juz-direction";
import { canEditPlan, teacherGroupLimit } from "@/lib/students/manage";
import { TEMPLATE_KEY_PLAN, planProblem, type TemplateKey } from "@/lib/students/new-student";
import { PLAN_FIELDS, inferDirectionsFromHistory, studentPlan } from "@/lib/students/plan";
import { pickByGroup, studentNounDef, type GroupGender } from "@/lib/text/gender";
import { AYAH_COUNT, SURAH_NAME } from "@/lib/quran-data";
import type { TrackKind } from "@/lib/recitation/tracks";

// «خطة الحفظ» on the student page: changing her plan (any template, then
// freely reordered as when she was added), and correcting the direction of
// a juz in an untouched «ترتيب المصحف بالعكس».
//
// Who: the supervisor; a teacher with «تعديل خطة الحفظ» and only for a
// student she can see. Never an archived student. Sessions are never
// touched: position, coverage and gaps are re-derived from them. A plan
// change stamps planChangedAt, so gaps approved before it stop counting; a
// direction correction doesn't (approvals are re-read in the corrected
// order). A correction is stored as MANUAL, which nothing automatic replaces.

export type PlanEditResult = { error: string } | { ok: true };

const DENIED = "ليست لديك صلاحية تعديل خطة الحفظ";

type PlanStudent = { id: string; group: { gender: GroupGender } } & Parameters<typeof studentPlan>[0];

async function planAccess(session: Session, studentId: unknown): Promise<{ error: string } | { student: PlanStudent }> {
  const course = await prisma.course.findUniqueOrThrow({
    where: { id: session.courseId },
    select: { editPlanPermission: true, visibilityMode: true },
  });
  if (!canEditPlan(session, course)) return { error: DENIED };
  const student = await prisma.student.findFirst({
    where: { id: String(studentId ?? ""), courseId: session.courseId },
    select: { id: true, groupId: true, archivedAt: true, group: { select: { gender: true } }, ...PLAN_FIELDS },
  });
  if (!student) return { error: "غير موجود في هذه الدورة" };
  const g = student.group.gender;
  if (student.archivedAt) {
    return { error: `${studentNounDef(g)} في الأرشيف، فلا يمكن تعديل ${pickByGroup(g, { m: "خطته", f: "خطتها" })}` };
  }
  const limit = await teacherGroupLimit(session, course);
  if (limit && !limit.includes(student.groupId)) {
    return { error: `ليست لديك صلاحية على ${pickByGroup(g, { m: "هذا", f: "هذه" })} ${studentNounDef(g)}` };
  }
  return { student };
}

export async function saveStudentPlanAction(studentId: string, input: unknown): Promise<PlanEditResult> {
  const session = await requireSession();
  const access = await planAccess(session, studentId);
  if ("error" in access) return { error: access.error };
  const { student } = access;

  const raw = input as { template?: unknown; plan?: unknown } | null;
  const template = TEMPLATE_KEY_PLAN[String(raw?.template) as TemplateKey];
  if (!template) return { error: "قالب الخطة غير صحيح" };
  const plan = Array.isArray(raw?.plan) ? raw.plan.map(Number) : [];
  const problem = planProblem(plan);
  if (problem) return { error: problem };

  const stored = student.planItems.map((p) => p.surahNumber);
  if (template === student.planTemplate && plan.join(",") === stored.join(",")) return { ok: true };

  await prisma.$transaction(async (tx) => {
    await tx.planItem.deleteMany({ where: { studentId: student.id } });
    await tx.planItem.createMany({ data: plan.map((surahNumber, position) => ({ studentId: student.id, surahNumber, position })) });
    await tx.student.update({ where: { id: student.id }, data: { planTemplate: template, planChangedAt: new Date() } });
    // moved onto the reverse plan: the juz she has already started keep the
    // direction her memorization shows (directions already set are kept)
    await inferDirectionsFromHistory(tx, student.id);
  });

  revalidatePath(`/students/${student.id}`);
  return { ok: true };
}

export async function setJuzDirectionAction(studentId: string, juz: unknown, direction: unknown): Promise<PlanEditResult> {
  const session = await requireSession();
  const access = await planAccess(session, studentId);
  if ("error" in access) return { error: access.error };
  const { student } = access;

  const j = Number(juz);
  if (!Number.isInteger(j) || !juzHasDirection(j)) return { error: "هذا الجزء لا اتجاه له" };
  if (direction !== "FROM_START" && direction !== "FROM_END") return { error: "الاتجاه غير صحيح" };
  if (!studentPlan(student).directions) return { error: "اتجاه الأجزاء متاح في خطة «ترتيب المصحف بالعكس» دون تعديل على ترتيبها فقط" };

  const value: JuzDirection = direction;
  await prisma.studentJuzDirection.upsert({
    where: { studentId_juz: { studentId: student.id, juz: j } },
    create: { studentId: student.id, juz: j, direction: value, source: "MANUAL" },
    update: { direction: value, source: "MANUAL", setAt: new Date() },
  });

  revalidatePath(`/students/${student.id}`);
  return { ok: true };
}

// ---------- her second track (lib/recitation/tracks.ts) ----------
// Same permission as changing her plan. At most one active track (also a
// partial unique index); ending it keeps the row, and its memorization
// stays counted — only the track stops.

const TRACK_KINDS: TrackKind[] = ["MUSHAF", "REVERSE", "FREE"];

export async function addSecondTrackAction(studentId: string, input: unknown): Promise<PlanEditResult> {
  const session = await requireSession();
  const access = await planAccess(session, studentId);
  if ("error" in access) return { error: access.error };
  const { student } = access;

  const raw = input as { kind?: unknown; startSurah?: unknown; startAyah?: unknown } | null;
  const kind = TRACK_KINDS.find((k) => k === raw?.kind);
  if (!kind) return { error: "نوع المسار غير صحيح" };
  let startSurah: number | null = null;
  let startAyah: number | null = null;
  if (kind !== "FREE") {
    startSurah = Number(raw?.startSurah);
    startAyah = Number(raw?.startAyah);
    if (!Number.isInteger(startSurah) || startSurah < 1 || startSurah > 114) return { error: "سورة البداية غير صحيحة" };
    if (!Number.isInteger(startAyah) || startAyah < 1 || startAyah > AYAH_COUNT[startSurah]) {
      return { error: `سورة ${SURAH_NAME[startSurah]} فيها ${AYAH_COUNT[startSurah]} آية` };
    }
  }

  const already = `${pickByGroup(student.group.gender, { m: "لديه", f: "لديها" })} مسار ثانٍ بالفعل`;
  if (studentPlan(student).second) return { error: already };
  try {
    await prisma.studentTrack.create({ data: { studentId: student.id, kind, startSurah, startAyah } });
  } catch {
    // another tap or another staff member added one first (partial unique index)
    return { error: already };
  }

  revalidatePath(`/students/${student.id}`);
  return { ok: true };
}

export async function endSecondTrackAction(studentId: string): Promise<PlanEditResult> {
  const session = await requireSession();
  const access = await planAccess(session, studentId);
  if ("error" in access) return { error: access.error };
  const { student } = access;

  await prisma.studentTrack.updateMany({ where: { studentId: student.id, endedAt: null }, data: { endedAt: new Date() } });

  revalidatePath(`/students/${student.id}`);
  return { ok: true };
}
