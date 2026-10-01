"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { ASSIGNMENT_LIMITS, validateAssignment, type AssignmentInput } from "@/lib/assignments/rules";
import { detachAssignmentSegments, syncAssignmentSegments } from "@/lib/assignments/segments";
import {
  checkGroup,
  checkStudents,
  creatorId,
  FEATURE_OFF,
  getStaffScope,
  inScope,
  NO_GROUP_ACCESS,
  ownsRecord,
  type StaffScope,
} from "@/lib/staff-scope";

// Staff assignments. Every action re-checks: the feature is on, the target
// group / every picked student is within her groups, and (edit/delete) that
// she created it — the supervisor may edit everything. Never touches
// RecitationSession or PointsLog.

export type AssignmentTargetInput = { kind: "GROUP"; groupId: string } | { kind: "STUDENTS"; studentIds: string[] };
export type AssignmentResult = { error?: string };

const NOT_FOUND = { error: "لم يُعثر على هذا الواجب" };
const NOT_OWNER = { error: "يمكن تعديل الواجب أو حذفه لمن أنشأه أو للإشراف فقط" };
const BAD_STUDENTS = { error: "يُرجى اختيار طلاب صحيحين من مجموعاتك" };

function refresh() {
  revalidatePath("/assignments");
  revalidatePath("/students", "layout");
  revalidatePath("/student", "layout");
  revalidatePath("/parent", "layout");
}

/** The checked target: a group in her scope, or picked students all in her scope. */
async function checkTarget(scope: StaffScope, target: AssignmentTargetInput | null | undefined) {
  if (target?.kind === "GROUP") {
    const group = await checkGroup(scope, target.groupId);
    return group ? ({ groupId: group.id, studentIds: [] as string[] } as const) : ({ error: NO_GROUP_ACCESS } as const);
  }
  if (target?.kind === "STUDENTS") {
    const students = await checkStudents(scope, target.studentIds, ASSIGNMENT_LIMITS.studentsMax);
    return students ? ({ groupId: null, studentIds: students.map((s) => s.id) } as const) : BAD_STUDENTS;
  }
  return { error: "يُرجى اختيار من يُكلَّف بالواجب" } as const;
}

const fields = (v: AssignmentInput) => ({
  title: v.title,
  description: v.description,
  type: v.type,
  dueDate: v.dueDate ? new Date(`${v.dueDate}T00:00:00Z`) : null,
  surahNumber: v.surahNumber,
  fromAyah: v.fromAyah,
  toAyah: v.toAyah,
});

export async function createAssignmentAction(input: AssignmentInput, target: AssignmentTargetInput): Promise<AssignmentResult> {
  const scope = await getStaffScope("assignments");
  if (!scope) return { error: FEATURE_OFF.assignments };
  const checked = validateAssignment(input, scope.homeLogEnabled);
  if ("error" in checked) return { error: checked.error };
  const t = await checkTarget(scope, target);
  if ("error" in t) return { error: t.error };

  const a = await prisma.assignment.create({
    data: {
      ...fields(checked.value),
      courseId: scope.courseId,
      targetGroupId: t.groupId,
      createdByTeacherId: creatorId(scope),
      students: { create: t.studentIds.map((studentId) => ({ studentId })) },
    },
    select: { id: true },
  });
  await syncAssignmentSegments(a.id);
  refresh();
  return {};
}

async function ownAssignment(scope: StaffScope, id: unknown) {
  const a = await prisma.assignment.findFirst({
    where: { id: String(id ?? ""), courseId: scope.courseId },
    select: {
      id: true,
      createdByTeacherId: true,
      students: { select: { studentId: true, student: { select: { groupId: true } } } },
    },
  });
  if (!a) return NOT_FOUND;
  if (!ownsRecord(scope, a.createdByTeacherId)) return NOT_OWNER;
  return { a };
}

export async function updateAssignmentAction(id: string, input: AssignmentInput, target: AssignmentTargetInput): Promise<AssignmentResult> {
  const scope = await getStaffScope("assignments");
  if (!scope) return { error: FEATURE_OFF.assignments };
  const found = await ownAssignment(scope, id);
  if ("error" in found) return { error: found.error };
  const checked = validateAssignment(input, scope.homeLogEnabled);
  if ("error" in checked) return { error: checked.error };
  const t = await checkTarget(scope, target);
  if ("error" in t) return { error: t.error };

  // picked students outside her groups (her groups changed since) aren't
  // hers to see or remove: they stay picked
  const keep = t.groupId ? [] : found.a.students.filter((s) => !inScope(scope, s.student.groupId)).map((s) => s.studentId);
  const studentIds = [...new Set([...t.studentIds, ...keep])];

  await prisma.$transaction([
    prisma.assignmentStudent.deleteMany({ where: { assignmentId: found.a.id } }),
    prisma.assignment.update({
      where: { id: found.a.id },
      data: {
        ...fields(checked.value),
        targetGroupId: t.groupId,
        students: { create: studentIds.map((studentId) => ({ studentId })) },
      },
    }),
  ]);
  await syncAssignmentSegments(found.a.id);
  refresh();
  return {};
}

export async function deleteAssignmentAction(id: string): Promise<AssignmentResult> {
  const scope = await getStaffScope("assignments");
  if (!scope) return { error: FEATURE_OFF.assignments };
  const found = await ownAssignment(scope, id);
  if ("error" in found) return { error: found.error };
  // D4: untouched segments go, practised ones stay hers (unlinked)
  await detachAssignmentSegments(found.a.id);
  await prisma.assignment.delete({ where: { id: found.a.id } });
  refresh();
  return {};
}
