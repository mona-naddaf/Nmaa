"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth/require";
import { resolveTeacherId } from "@/lib/auth/teacher-identity";
import { studentCreateData, validateNewStudent, type PriorPartial } from "@/lib/students/new-student";
import { imperative, studentsNoun, NEUTRAL_GROUP_GENDER } from "@/lib/text/gender";

export type ActionState = { error?: string } | null;

const TEMPLATE_MAP = { mushaf: "MUSHAF_ORDER", mushafrev: "MUSHAF_REVERSE", juzamma: "JUZ_AMMA_REVERSE", custom: "CUSTOM" } as const;

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

  const groupId = String(formData.get("groupId") ?? "");
  const templateKey = String(formData.get("template") ?? "custom") as keyof typeof TEMPLATE_MAP;

  const group = await prisma.group.findFirst({ where: { id: groupId, courseId: course.id } });
  if (!group) return { error: "يُرجى اختيار مجموعة صحيحة" };

  let plan: number[];
  try {
    plan = JSON.parse(String(formData.get("plan") ?? "[]"));
    if (!Array.isArray(plan)) throw new Error("invalid");
  } catch {
    return { error: "خطة غير صحيحة" };
  }

  // ---------- prior memorization (from before she joined) ----------
  let priorCompletedSurahs: number[];
  try {
    priorCompletedSurahs = JSON.parse(String(formData.get("priorCompletedSurahs") ?? "[]"));
    if (!Array.isArray(priorCompletedSurahs)) throw new Error("invalid");
  } catch {
    return { error: "قائمة السور المحفوظة سابقًا غير صحيحة" };
  }

  let priorPartial: PriorPartial | null = null;
  const priorPartialRaw = String(formData.get("priorPartial") ?? "");
  if (priorPartialRaw) {
    try {
      priorPartial = JSON.parse(priorPartialRaw);
      if (!priorPartial || typeof priorPartial !== "object") throw new Error("invalid");
    } catch {
      return { error: "بيانات السورة الجارية غير صحيحة" };
    }
  }

  const result = validateNewStudent(
    {
      name: String(formData.get("name") ?? ""),
      grade: String(formData.get("grade") ?? ""),
      age: parseInt(String(formData.get("age") ?? ""), 10),
      planTemplate: TEMPLATE_MAP[templateKey] ?? "CUSTOM",
      plan,
      priorCompletedSurahs,
      priorPartial,
    },
    group.gender,
  );
  if ("error" in result) return { error: result.error };

  const teacherId = await resolveTeacherId(session);
  const student = await prisma.student.create({
    data: studentCreateData(result.student, { courseId: course.id, groupId: group.id, teacherId }),
  });

  redirect(`/students/${student.id}`);
}
