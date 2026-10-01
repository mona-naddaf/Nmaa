"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { TRACKER_LIMITS, validateDays, validateTitle, validateValue } from "@/lib/tracker/rules";
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

// Staff side of the daily tracker. Every action re-checks: the feature is
// on, the group / every picked student is within her groups, and who may
// change the item — its staff creator or the supervisor; for a student's own
// item, any staff member over her group (D9). D7 limits are enforced here.
// Items are archived, never deleted (D6: they stop counting from that day).

export type TrackerItemInput = { title: string; value: number; days: number };
export type TrackerTargetInput = { kind: "GROUP"; groupId: string } | { kind: "STUDENTS"; studentIds: string[] };
export type TrackerResult = { error?: string };

const NOT_FOUND = { error: "لم يُعثر على هذا البند" };
const NOT_OWNER = { error: "يمكن تعديل البند لمن أنشأه أو للإشراف فقط" };
const BAD_VALUE = { error: `يُرجى اختيار درجة من ${TRACKER_LIMITS.valueMin} إلى ${TRACKER_LIMITS.valueMax}` };
const BAD_DAYS = { error: "يُرجى اختيار يوم واحد على الأقل" };

function refresh() {
  revalidatePath("/tracker");
  revalidatePath("/students", "layout");
  revalidatePath("/student", "layout");
  revalidatePath("/parent", "layout");
}

function checkFields(input: Partial<TrackerItemInput> | null | undefined) {
  const t = validateTitle(input?.title);
  if ("error" in t) return t;
  const value = validateValue(input?.value);
  if (value === null) return BAD_VALUE;
  const days = validateDays(input?.days);
  if (days === null) return BAD_DAYS;
  return { title: t.title, value, days };
}

export async function createTrackerItemAction(input: TrackerItemInput, target: TrackerTargetInput): Promise<TrackerResult> {
  const scope = await getStaffScope("tracker");
  if (!scope) return { error: FEATURE_OFF.tracker };
  const fields = checkFields(input);
  if ("error" in fields) return { error: fields.error };

  if (target?.kind === "GROUP") {
    const group = await checkGroup(scope, target.groupId);
    if (!group) return { error: NO_GROUP_ACCESS };
    const active = await prisma.trackerItem.count({ where: { targetGroupId: group.id, archivedAt: null, status: "APPROVED" } });
    if (active >= TRACKER_LIMITS.activeItemsPerGroup) {
      return { error: `للمجموعة ${TRACKER_LIMITS.activeItemsPerGroup} بندًا نشطًا على الأكثر — يُرجى أرشفة بند أولًا` };
    }
    await prisma.trackerItem.create({ data: { ...fields, courseId: scope.courseId, targetGroupId: group.id, createdByTeacherId: creatorId(scope) } });
  } else if (target?.kind === "STUDENTS") {
    const students = await checkStudents(scope, target.studentIds, 100);
    if (!students) return { error: "يُرجى اختيار طلاب صحيحين من مجموعاتك" };
    const counts = await prisma.trackerItemStudent.groupBy({
      by: ["studentId"],
      where: { studentId: { in: students.map((s) => s.id) }, item: { archivedAt: null } },
      _count: { _all: true },
    });
    if (counts.some((c) => c._count._all >= TRACKER_LIMITS.individualItemsPerStudent)) {
      return { error: `لا يمكن أن يُخصَّص لأحد أكثر من ${TRACKER_LIMITS.individualItemsPerStudent} بندًا فرديًا نشطًا` };
    }
    await prisma.trackerItem.create({
      data: {
        ...fields,
        courseId: scope.courseId,
        createdByTeacherId: creatorId(scope),
        students: { create: students.map((s) => ({ studentId: s.id })) },
      },
    });
  } else {
    return { error: "يُرجى اختيار لمن البند" };
  }
  refresh();
  return {};
}

/** The item, if she may change it (and it's not archived). */
async function editableItem(scope: StaffScope, id: unknown) {
  const item = await prisma.trackerItem.findFirst({
    where: { id: String(id ?? ""), courseId: scope.courseId, archivedAt: null },
    select: {
      id: true,
      status: true,
      createdByTeacherId: true,
      createdByStudent: { select: { groupId: true } },
    },
  });
  if (!item) return NOT_FOUND;
  if (item.createdByStudent) {
    if (!inScope(scope, item.createdByStudent.groupId)) return { error: NO_GROUP_ACCESS };
  } else if (!ownsRecord(scope, item.createdByTeacherId)) {
    return NOT_OWNER;
  }
  return { item };
}

/** Title, score and days (an approved item; pending ones go through approval). */
export async function updateTrackerItemAction(id: string, input: TrackerItemInput): Promise<TrackerResult> {
  const scope = await getStaffScope("tracker");
  if (!scope) return { error: FEATURE_OFF.tracker };
  const found = await editableItem(scope, id);
  if ("error" in found) return { error: found.error };
  if (found.item.status !== "APPROVED") return { error: "يُرجى اعتماد البند أولًا" };
  const fields = checkFields(input);
  if ("error" in fields) return { error: fields.error };
  await prisma.trackerItem.update({ where: { id: found.item.id }, data: fields });
  refresh();
  return {};
}

export async function archiveTrackerItemAction(id: string): Promise<TrackerResult> {
  const scope = await getStaffScope("tracker");
  if (!scope) return { error: FEATURE_OFF.tracker };
  const found = await editableItem(scope, id);
  if ("error" in found) return { error: found.error };
  await prisma.trackerItem.update({ where: { id: found.item.id }, data: { archivedAt: new Date() } });
  refresh();
  return {};
}

/** A student's pending item, within her group's staff. */
async function pendingItem(scope: StaffScope, id: unknown) {
  const item = await prisma.trackerItem.findFirst({
    where: { id: String(id ?? ""), courseId: scope.courseId, status: "PENDING", archivedAt: null },
    select: { id: true, createdByStudent: { select: { groupId: true } } },
  });
  if (!item || !item.createdByStudent) return { error: "هذا البند لم يعد بانتظار الاعتماد" } as const;
  if (!inScope(scope, item.createdByStudent.groupId)) return { error: NO_GROUP_ACCESS } as const;
  return { item } as const;
}

/** Approving sets its score (D7: 1–10); a title tidy-up is allowed at the same time. */
export async function approveTrackerItemAction(id: string, value: number, title?: string): Promise<TrackerResult> {
  const scope = await getStaffScope("tracker");
  if (!scope) return { error: FEATURE_OFF.tracker };
  const found = await pendingItem(scope, id);
  if ("error" in found) return { error: found.error };
  const v = validateValue(value);
  if (v === null) return BAD_VALUE;
  const t = title === undefined ? null : validateTitle(title);
  if (t && "error" in t) return { error: t.error };
  await prisma.trackerItem.update({
    where: { id: found.item.id },
    data: { status: "APPROVED", value: v, reviewedAt: new Date(), ...(t ? { title: t.title } : {}) },
  });
  refresh();
  return {};
}

export async function rejectTrackerItemAction(id: string): Promise<TrackerResult> {
  const scope = await getStaffScope("tracker");
  if (!scope) return { error: FEATURE_OFF.tracker };
  const found = await pendingItem(scope, id);
  if ("error" in found) return { error: found.error };
  await prisma.trackerItem.update({ where: { id: found.item.id }, data: { status: "REJECTED", reviewedAt: new Date() } });
  refresh();
  return {};
}
