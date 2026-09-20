"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth/require";
import { AYAH_COUNT } from "@/lib/quran-data";

export type ActionState = { error?: string } | null;

const TEMPLATE_MAP = { mushaf: "MUSHAF_ORDER", juzamma: "JUZ_AMMA_REVERSE", custom: "CUSTOM" } as const;

export async function createStudentAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requireSession();

  const course = await prisma.course.findUniqueOrThrow({ where: { id: session.courseId } });
  const canAdd = session.role === "admin" || course.addStudentsPermission === "ALL_TEACHERS";
  if (!canAdd) {
    return { error: "لا تملكين صلاحية إضافة طالبات جديدات في هذه الدورة" };
  }

  const name = String(formData.get("name") ?? "").trim();
  const age = parseInt(String(formData.get("age") ?? ""), 10);
  const groupId = String(formData.get("groupId") ?? "");
  const templateKey = String(formData.get("template") ?? "custom") as keyof typeof TEMPLATE_MAP;
  const planRaw = String(formData.get("plan") ?? "[]");

  if (!name) return { error: "يُرجى إدخال اسم الطالبة" };
  if (!Number.isFinite(age) || age < 1 || age > 25) return { error: "يُرجى إدخال عمر صحيح" };

  const group = await prisma.group.findFirst({ where: { id: groupId, courseId: course.id } });
  if (!group) return { error: "يُرجى اختيار مجموعة صحيحة" };

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

  const student = await prisma.student.create({
    data: {
      courseId: course.id,
      groupId: group.id,
      name,
      age,
      planTemplate: TEMPLATE_MAP[templateKey] ?? "CUSTOM",
      planItems: { create: plan.map((surahNumber, position) => ({ surahNumber, position })) },
    },
  });

  redirect(`/students/${student.id}`);
}
