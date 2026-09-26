import type { PlanTemplate, Prisma } from "@prisma/client";
import { AYAH_COUNT, JUZ_AMMA_REVERSE_ORDER, MUSHAF_ORDER, MUSHAF_REVERSE_ORDER } from "@/lib/quran-data";
import { calculatePageRange } from "@/lib/recitation/logic";
import { studentNounDef, type GroupGender } from "@/lib/text/gender";

// The one set of rules for creating a student with a plan and prior
// memorization — shared by the manual form (students/new/actions.ts) and the
// Excel bulk import (students/import/actions.ts), so the two can't drift.
// Pure (no DB access): callers resolve the group and the attributing teacher.

export const MIN_AGE = 1;
export const MAX_AGE = 25;
export const MAX_GRADE_LENGTH = 40;

// Display labels, in the order the templates are offered in the import sheet.
export const PLAN_TEMPLATE_LABEL: Record<PlanTemplate, string> = {
  MUSHAF_ORDER: "ترتيب المصحف",
  MUSHAF_REVERSE: "ترتيب المصحف بالعكس",
  JUZ_AMMA_REVERSE: "جزء عمّ بالعكس",
  CUSTOM: "خطة مخصّصة",
};

export const PLAN_TEMPLATES = Object.keys(PLAN_TEMPLATE_LABEL) as PlanTemplate[];

/**
 * The surah sequence a template starts from. CUSTOM starts empty in the
 * manual form (the supervisor picks surahs by hand); the import has no way
 * to pick surahs, so there CUSTOM falls back to plain Mushaf order.
 */
export function templatePlan(template: PlanTemplate, customFallback: number[] = []): number[] {
  switch (template) {
    case "MUSHAF_ORDER":
      return MUSHAF_ORDER;
    case "MUSHAF_REVERSE":
      return MUSHAF_REVERSE_ORDER;
    case "JUZ_AMMA_REVERSE":
      return JUZ_AMMA_REVERSE_ORDER;
    case "CUSTOM":
      return customFallback;
  }
}

/**
 * "From surah X to surah Y" as the surahs between them in the student's
 * plan order (not Mushaf order), endpoints in either order. null when either
 * end isn't in the plan.
 */
export function planRange(plan: number[], from: number, to: number): number[] | null {
  const posFrom = plan.indexOf(from);
  const posTo = plan.indexOf(to);
  if (posFrom === -1 || posTo === -1) return null;
  const [lo, hi] = posFrom <= posTo ? [posFrom, posTo] : [posTo, posFrom];
  return plan.slice(lo, hi + 1);
}

/**
 * Key for "is this the same student name": ignores surrounding/repeated
 * whitespace, tashkeel and tatweel, which are invisible or near-invisible
 * differences — but not letter variants (أ/ا, ة/ه), which can be real ones.
 */
export function studentNameKey(name: string): string {
  return name
    .normalize("NFC")
    .replace(/[ً-ٰٟـ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export interface PriorPartial {
  surahNumber: number;
  fromAyah: number;
  toAyah: number;
}

export interface NewStudentInput {
  name: string;
  grade: string;
  age: number;
  planTemplate: PlanTemplate;
  plan: number[];
  priorCompletedSurahs: number[];
  priorPartial: PriorPartial | null;
}

export type ValidatedStudent = Omit<NewStudentInput, "grade"> & { grade: string | null };

export function validateNewStudent(
  input: NewStudentInput,
  groupGender: GroupGender,
): { error: string } | { student: ValidatedStudent } {
  const name = input.name.trim();
  const grade = input.grade.trim();
  const { age, plan, priorCompletedSurahs, priorPartial } = input;

  if (!name) return { error: `يُرجى إدخال اسم ${studentNounDef(groupGender)}` };
  if (!Number.isInteger(age) || age < MIN_AGE || age > MAX_AGE) return { error: "يُرجى إدخال عمر صحيح" };
  if (grade.length > MAX_GRADE_LENGTH) return { error: "الصف طويل جدًا" };

  if (plan.some((n) => typeof n !== "number" || !AYAH_COUNT[n]) || new Set(plan).size !== plan.length) {
    return { error: "خطة غير صحيحة" };
  }
  if (plan.length === 0) return { error: "يُرجى إضافة سورة واحدة على الأقل إلى الخطة" };

  if (priorCompletedSurahs.some((n) => typeof n !== "number")) {
    return { error: "قائمة السور المحفوظة سابقًا غير صحيحة" };
  }
  if (new Set(priorCompletedSurahs).size !== priorCompletedSurahs.length) {
    return { error: "توجد سورة مكرَّرة في قائمة السور المحفوظة سابقًا" };
  }
  if (priorCompletedSurahs.some((n) => !plan.includes(n))) {
    return { error: `لا يمكن تحديد سورة محفوظة سابقًا غير موجودة في خطة ${studentNounDef(groupGender)}` };
  }

  if (priorPartial) {
    if (!plan.includes(priorPartial.surahNumber)) {
      return { error: `لا يمكن تحديد سورة جارية غير موجودة في خطة ${studentNounDef(groupGender)}` };
    }
    if (priorCompletedSurahs.includes(priorPartial.surahNumber)) {
      return { error: "لا يمكن أن تكون نفس السورة محفوظة بالكامل وجارية في آن واحد" };
    }
    const range = calculatePageRange(priorPartial.surahNumber, priorPartial.fromAyah, priorPartial.toAyah);
    if ("error" in range) return { error: range.error };
  }

  return { student: { ...input, name, grade: grade || null } };
}

/**
 * Create input for a validated student: the student row, her plan, and one
 * PRIOR baseline session per fully-memorized surah plus one for the partial
 * surah, all attributed to `teacherId`.
 */
export function studentCreateData(
  student: ValidatedStudent,
  { courseId, groupId, teacherId }: { courseId: string; groupId: string; teacherId: string },
): Prisma.StudentUncheckedCreateInput {
  const priorSessions = [
    ...student.priorCompletedSurahs.map((surahNumber) => ({ surahNumber, fromAyah: 1, toAyah: AYAH_COUNT[surahNumber] })),
    ...(student.priorPartial ? [student.priorPartial] : []),
  ].map(({ surahNumber, fromAyah, toAyah }) => {
    const range = calculatePageRange(surahNumber, fromAyah, toAyah);
    return {
      teacherId,
      source: "PRIOR" as const,
      surahNumber,
      fromAyah,
      toAyah,
      pagesCalculated: "error" in range ? 0 : range.totalPages,
    };
  });

  return {
    courseId,
    groupId,
    name: student.name,
    grade: student.grade,
    age: student.age,
    planTemplate: student.planTemplate,
    planItems: { createMany: { data: student.plan.map((surahNumber, position) => ({ surahNumber, position })) } },
    recitationSessions: { createMany: { data: priorSessions } },
  };
}
