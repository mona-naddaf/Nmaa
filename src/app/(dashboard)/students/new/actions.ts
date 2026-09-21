"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth/require";
import { resolveTeacherId } from "@/lib/auth/teacher-identity";
import { AYAH_COUNT } from "@/lib/quran-data";
import { calculatePageRange } from "@/lib/recitation/logic";
import { imperative, studentNounDef, studentsNoun, NEUTRAL_GROUP_GENDER, type GroupGender } from "@/lib/text/gender";

export type ActionState = { error?: string } | null;

const TEMPLATE_MAP = { mushaf: "MUSHAF_ORDER", juzamma: "JUZ_AMMA_REVERSE", custom: "CUSTOM" } as const;

interface PriorPartial {
  surahNumber: number;
  fromAyah: number;
  toAyah: number;
}

export async function createStudentAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requireSession();

  const course = await prisma.course.findUniqueOrThrow({ where: { id: session.courseId } });
  const canAdd = session.role === "admin" || course.addStudentsPermission === "ALL_TEACHERS";
  if (!canAdd) {
    // session.role is guaranteed "teacher" here — canAdd is only false when
    // session.role !== "admin" (see the || above)
    const teacher = await prisma.teacher.findUnique({ where: { id: session.teacherId }, select: { gender: true } });
    return {
      error: `لا ${imperative(teacher?.gender ?? null, { m: "تملك", f: "تملكين" })} صلاحية إضافة ${studentsNoun(NEUTRAL_GROUP_GENDER)} جدد في هذه الدورة`,
    };
  }

  const name = String(formData.get("name") ?? "").trim();
  const age = parseInt(String(formData.get("age") ?? ""), 10);
  const groupId = String(formData.get("groupId") ?? "");
  const templateKey = String(formData.get("template") ?? "custom") as keyof typeof TEMPLATE_MAP;
  const planRaw = String(formData.get("plan") ?? "[]");

  const group = await prisma.group.findFirst({ where: { id: groupId, courseId: course.id } });
  if (!group) return { error: "يُرجى اختيار مجموعة صحيحة" };
  const groupGender: GroupGender = group.gender;

  if (!name) return { error: `يُرجى إدخال اسم ${studentNounDef(groupGender)}` };
  if (!Number.isFinite(age) || age < 1 || age > 25) return { error: "يُرجى إدخال عمر صحيح" };

  let plan: number[];
  try {
    plan = JSON.parse(planRaw);
    if (!Array.isArray(plan) || plan.some((n) => typeof n !== "number" || !AYAH_COUNT[n])) {
      throw new Error("invalid");
    }
  } catch {
    return { error: "خطة غير صحيحة" };
  }
  if (plan.length === 0) return { error: "يُرجى إضافة سورة واحدة على الأقل إلى الخطة" };

  // ---------- prior memorization (from before she joined) ----------
  let priorCompletedSurahs: number[] = [];
  try {
    priorCompletedSurahs = JSON.parse(String(formData.get("priorCompletedSurahs") ?? "[]"));
    if (!Array.isArray(priorCompletedSurahs) || priorCompletedSurahs.some((n) => typeof n !== "number")) {
      throw new Error("invalid");
    }
  } catch {
    return { error: "قائمة السور المحفوظة سابقًا غير صحيحة" };
  }
  if (new Set(priorCompletedSurahs).size !== priorCompletedSurahs.length) {
    return { error: "توجد سورة مكرَّرة في قائمة السور المحفوظة سابقًا" };
  }
  if (priorCompletedSurahs.some((n) => !plan.includes(n))) {
    return { error: `لا يمكن تحديد سورة محفوظة سابقًا غير موجودة في خطة ${studentNounDef(groupGender)}` };
  }

  let priorPartial: PriorPartial | null = null;
  const priorPartialRaw = String(formData.get("priorPartial") ?? "");
  if (priorPartialRaw) {
    try {
      priorPartial = JSON.parse(priorPartialRaw);
    } catch {
      return { error: "بيانات السورة الجارية غير صحيحة" };
    }
    if (!priorPartial || !plan.includes(priorPartial.surahNumber)) {
      return { error: `لا يمكن تحديد سورة جارية غير موجودة في خطة ${studentNounDef(groupGender)}` };
    }
    if (priorCompletedSurahs.includes(priorPartial.surahNumber)) {
      return { error: "لا يمكن أن تكون نفس السورة محفوظة بالكامل وجارية في آن واحد" };
    }
    const range = calculatePageRange(priorPartial.surahNumber, priorPartial.fromAyah, priorPartial.toAyah);
    if ("error" in range) {
      return { error: range.error };
    }
  }

  const teacherId = await resolveTeacherId(session);

  const priorSessionsData = [
    ...priorCompletedSurahs.map((surahNumber) => {
      const toAyah = AYAH_COUNT[surahNumber];
      const range = calculatePageRange(surahNumber, 1, toAyah);
      return {
        teacherId,
        source: "PRIOR" as const,
        surahNumber,
        fromAyah: 1,
        toAyah,
        pagesCalculated: "error" in range ? 0 : range.totalPages,
      };
    }),
    ...(priorPartial
      ? [
          {
            teacherId,
            source: "PRIOR" as const,
            surahNumber: priorPartial.surahNumber,
            fromAyah: priorPartial.fromAyah,
            toAyah: priorPartial.toAyah,
            pagesCalculated: (calculatePageRange(priorPartial.surahNumber, priorPartial.fromAyah, priorPartial.toAyah) as { totalPages: number }).totalPages,
          },
        ]
      : []),
  ];

  const student = await prisma.student.create({
    data: {
      courseId: course.id,
      groupId: group.id,
      name,
      age,
      planTemplate: TEMPLATE_MAP[templateKey] ?? "CUSTOM",
      planItems: { create: plan.map((surahNumber, position) => ({ surahNumber, position })) },
      recitationSessions: { create: priorSessionsData },
    },
  });

  redirect(`/students/${student.id}`);
}
