"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/require";
import { generateUniqueBoardCode } from "@/lib/auth/board-code";
import { pickByGroup, studentsNoun, type GroupGender } from "@/lib/text/gender";

async function currentCourseId() {
  return (await requireAdmin()).courseId;
}

export async function setAddStudentsPermissionAction(value: "ADMIN_ONLY" | "ALL_TEACHERS") {
  const cid = await currentCourseId();
  await prisma.course.update({ where: { id: cid }, data: { addStudentsPermission: value } });
  revalidatePath("/settings");
}

const STUDENT_PERMISSION_FIELDS = ["editStudentsPermission", "archiveStudentsPermission"] as const;
export type StudentPermissionField = (typeof STUDENT_PERMISSION_FIELDS)[number];

export async function setStudentPermissionAction(field: StudentPermissionField, value: "ADMIN_ONLY" | "ALL_TEACHERS") {
  const cid = await currentCourseId();
  if (!STUDENT_PERMISSION_FIELDS.includes(field)) throw new Error("إعداد غير معروف");
  if (value !== "ADMIN_ONLY" && value !== "ALL_TEACHERS") throw new Error("خيار غير صحيح");
  await prisma.course.update({ where: { id: cid }, data: { [field]: value } });
  revalidatePath("/settings");
  revalidatePath("/students", "layout");
}

export async function setVisibilityModeAction(value: "ALL_TEACHERS" | "ASSIGNED") {
  const cid = await currentCourseId();
  await prisma.course.update({ where: { id: cid }, data: { visibilityMode: value } });
  revalidatePath("/settings");
}

export async function setOnlineRecitationEnabledAction(value: boolean) {
  const cid = await currentCourseId();
  await prisma.course.update({ where: { id: cid }, data: { onlineRecitationEnabled: value } });
  revalidatePath("/settings");
}

const PROGRESS_BAR_FIELDS = ["showSurahProgress", "showJuzProgress", "showQuranProgress", "showPlanProgress"] as const;
export type ProgressBarField = (typeof PROGRESS_BAR_FIELDS)[number];

export async function setProgressBarAction(field: ProgressBarField, enabled: boolean) {
  const cid = await currentCourseId();
  if (!PROGRESS_BAR_FIELDS.includes(field)) throw new Error("إعداد غير معروف");
  await prisma.course.update({ where: { id: cid }, data: { [field]: enabled } });
  revalidatePath("/settings");
  revalidatePath("/students/[id]", "page");
}

export async function setTeacherGroupAssignmentAction(teacherId: string, groupId: string | null) {
  const cid = await currentCourseId();
  const teacher = await prisma.teacher.findFirst({ where: { id: teacherId, courseId: cid, isSupervisorProxy: false } });
  if (!teacher) throw new Error("معلم غير موجود");

  await prisma.teacherGroupAssignment.deleteMany({ where: { teacherId } });
  if (groupId) {
    const group = await prisma.group.findFirst({ where: { id: groupId, courseId: cid } });
    if (!group) throw new Error("مجموعة غير موجودة");
    await prisma.teacherGroupAssignment.create({ data: { teacherId, groupId } });
  }
  revalidatePath("/settings");
}

// ---------- Groups ----------

export async function addGroupAction(name: string, gender: GroupGender = "GIRLS") {
  const cid = await currentCourseId();
  const trimmed = name.trim();
  if (!trimmed) return;
  const count = await prisma.group.count({ where: { courseId: cid } });
  await prisma.group.create({ data: { courseId: cid, name: trimmed, gender, sortOrder: count } });
  revalidatePath("/settings");
}

export async function renameGroupAction(groupId: string, name: string) {
  const cid = await currentCourseId();
  const trimmed = name.trim();
  if (!trimmed) return;
  await prisma.group.update({ where: { id: groupId, courseId: cid }, data: { name: trimmed } });
  revalidatePath("/settings");
}

export async function setGroupGenderAction(groupId: string, gender: GroupGender) {
  const cid = await currentCourseId();
  await prisma.group.update({ where: { id: groupId, courseId: cid }, data: { gender } });
  revalidatePath("/settings");
}

export type DeleteGroupResult = { error?: string; archivedToMove?: number };

// A group with active students can't be deleted (move them first, from each
// student's page). One that only has archived students can: they're moved to
// `moveArchivedTo` in the same transaction — the caller asks for it when the
// first attempt returns archivedToMove.
export async function deleteGroupAction(groupId: string, moveArchivedTo?: string): Promise<DeleteGroupResult> {
  const cid = await currentCourseId();
  const count = await prisma.group.count({ where: { courseId: cid } });
  if (count <= 1) {
    return { error: "لا بدّ من بقاء مجموعة واحدة على الأقل" };
  }
  const group = await prisma.group.findFirst({ where: { id: groupId, courseId: cid }, select: { gender: true } });
  if (!group) return { error: "المجموعة غير موجودة" };
  const studentsInGroup = await prisma.student.count({ where: { groupId, courseId: cid, archivedAt: null } });
  if (studentsInGroup > 0) {
    const g = group?.gender ?? "GIRLS";
    return {
      error: `لا يمكن حذف مجموعة بها ${studentsNoun(g)} — يُرجى نقل${pickByGroup(g, { m: "هم", f: "هنّ" })} أولًا`,
    };
  }
  const archivedInGroup = await prisma.student.count({ where: { groupId, courseId: cid, archivedAt: { not: null } } });
  if (archivedInGroup > 0) {
    if (!moveArchivedTo) return { archivedToMove: archivedInGroup };
    const target = await prisma.group.findFirst({ where: { id: moveArchivedTo, courseId: cid }, select: { id: true } });
    if (!target || target.id === groupId) return { error: "يُرجى اختيار مجموعة أخرى" };
    await prisma.$transaction([
      prisma.student.updateMany({ where: { groupId, courseId: cid, archivedAt: { not: null } }, data: { groupId: target.id } }),
      prisma.group.delete({ where: { id: groupId, courseId: cid } }),
    ]);
  } else {
    await prisma.group.delete({ where: { id: groupId, courseId: cid } });
  }
  revalidatePath("/settings");
  revalidatePath("/students", "layout");
  return {};
}

// ---------- Points activities ----------

export async function addPointsActivityAction(name: string, value: number, type: "ADD" | "SUBTRACT") {
  const cid = await currentCourseId();
  const trimmed = name.trim();
  if (!trimmed) return;
  const count = await prisma.pointsActivity.count({ where: { courseId: cid } });
  await prisma.pointsActivity.create({
    data: { courseId: cid, name: trimmed, value: Math.max(1, value || 1), type, sortOrder: count },
  });
  revalidatePath("/settings");
}

export async function renamePointsActivityAction(activityId: string, name: string) {
  const cid = await currentCourseId();
  const trimmed = name.trim();
  if (!trimmed) return;
  await prisma.pointsActivity.update({ where: { id: activityId, courseId: cid }, data: { name: trimmed } });
  revalidatePath("/settings");
}

export async function updatePointsActivityValueAction(activityId: string, value: number) {
  const cid = await currentCourseId();
  await prisma.pointsActivity.update({
    where: { id: activityId, courseId: cid },
    data: { value: Math.max(1, value || 1) },
  });
  revalidatePath("/settings");
}

export async function updatePointsActivityTypeAction(activityId: string, type: "ADD" | "SUBTRACT") {
  const cid = await currentCourseId();
  await prisma.pointsActivity.update({ where: { id: activityId, courseId: cid }, data: { type } });
  revalidatePath("/settings");
}

export async function deletePointsActivityAction(activityId: string) {
  const cid = await currentCourseId();
  await prisma.pointsActivity.delete({ where: { id: activityId, courseId: cid } });
  revalidatePath("/settings");
}

// ---------- Public board code ----------

export type BoardCodeResult = { error: string } | { code: string | null; createdAt: string | null };

// Issues a fresh board code. Bumping boardCodeVersion invalidates every
// board session opened with a previous code, so this doubles as "revoke and
// replace". Independent of the teacher course code and of parent codes.
export async function regenerateBoardCodeAction(): Promise<BoardCodeResult> {
  const cid = await currentCourseId();
  const code = await generateUniqueBoardCode();
  const updated = await prisma.course.update({
    where: { id: cid },
    data: { boardCode: code, boardCodeVersion: { increment: 1 }, boardCodeCreatedAt: new Date() },
    select: { boardCode: true, boardCodeCreatedAt: true },
  });
  revalidatePath("/settings");
  return { code: updated.boardCode, createdAt: updated.boardCodeCreatedAt?.toISOString() ?? null };
}

export async function revokeBoardCodeAction(): Promise<BoardCodeResult> {
  const cid = await currentCourseId();
  await prisma.course.update({
    where: { id: cid },
    data: { boardCode: null, boardCodeVersion: { increment: 1 }, boardCodeCreatedAt: null },
  });
  revalidatePath("/settings");
  return { code: null, createdAt: null };
}

// ---------- Review reminders ----------

// null turns reminders off; turning them on pre-fills 14 days
export async function setStreakModeAction(mode: "ATTENDANCE" | "RECITATION" | null): Promise<{ error?: string }> {
  const cid = await currentCourseId();
  if (mode !== null && mode !== "ATTENDANCE" && mode !== "RECITATION") {
    return { error: "خيار غير صحيح" };
  }
  await prisma.course.update({ where: { id: cid }, data: { streakMode: mode } });
  revalidatePath("/settings");
  revalidatePath("/students", "layout");
  return {};
}

export async function setReviewReminderDaysAction(days: number | null): Promise<{ error?: string }> {
  const cid = await currentCourseId();
  if (days !== null && (!Number.isInteger(days) || days < 1 || days > 365)) {
    return { error: "يُرجى إدخال عدد أيام بين 1 و365" };
  }
  await prisma.course.update({ where: { id: cid }, data: { reviewReminderDays: days } });
  revalidatePath("/settings");
  revalidatePath("/students", "layout");
  return {};
}

// ---------- Islamic calendar ----------

// The nav link, the /calendar page and the home banner all depend on these,
// so refresh the whole dashboard.
function refreshCalendarEverywhere() {
  revalidatePath("/", "layout");
}

export async function setCalendarEnabledAction(enabled: boolean) {
  const cid = await currentCourseId();
  await prisma.course.update({ where: { id: cid }, data: { calendarEnabled: enabled } });
  refreshCalendarEverywhere();
}

export async function setCalendarBannerEnabledAction(enabled: boolean): Promise<{ error?: string }> {
  const cid = await currentCourseId();
  const course = await prisma.course.findUniqueOrThrow({ where: { id: cid }, select: { calendarEnabled: true } });
  if (enabled && !course.calendarEnabled) return { error: "يُرجى تفعيل التقويم أولًا" };
  await prisma.course.update({ where: { id: cid }, data: { calendarBannerEnabled: enabled } });
  refreshCalendarEverywhere();
  return {};
}

export async function setCalendarEditPermissionAction(value: "ADMIN_ONLY" | "ALL_TEACHERS") {
  const cid = await currentCourseId();
  if (value !== "ADMIN_ONLY" && value !== "ALL_TEACHERS") throw new Error("خيار غير صحيح");
  await prisma.course.update({ where: { id: cid }, data: { calendarEditPermission: value } });
  refreshCalendarEverywhere();
}
