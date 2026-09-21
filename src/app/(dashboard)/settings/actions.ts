"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/require";
import { pickByGroup, studentsNoun, type GroupGender } from "@/lib/text/gender";

async function currentCourseId() {
  return (await requireAdmin()).courseId;
}

export async function setAddStudentsPermissionAction(value: "ADMIN_ONLY" | "ALL_TEACHERS") {
  const cid = await currentCourseId();
  await prisma.course.update({ where: { id: cid }, data: { addStudentsPermission: value } });
  revalidatePath("/settings");
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

export async function setTeacherGroupAssignmentAction(teacherId: string, groupId: string | null) {
  const cid = await currentCourseId();
  const teacher = await prisma.teacher.findFirst({ where: { id: teacherId, courseId: cid } });
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

export async function deleteGroupAction(groupId: string): Promise<{ error?: string }> {
  const cid = await currentCourseId();
  const count = await prisma.group.count({ where: { courseId: cid } });
  if (count <= 1) {
    return { error: "لازم يبقى مجموعة واحدة على الأقل" };
  }
  const group = await prisma.group.findFirst({ where: { id: groupId, courseId: cid }, select: { gender: true } });
  const studentsInGroup = await prisma.student.count({ where: { groupId, courseId: cid } });
  if (studentsInGroup > 0) {
    const g = group?.gender ?? "GIRLS";
    return {
      error: `لا يمكن حذف مجموعة بها ${studentsNoun(g)} — يُرجى نقل${pickByGroup(g, { m: "هم", f: "هنّ" })} أولًا`,
    };
  }
  await prisma.group.delete({ where: { id: groupId, courseId: cid } });
  revalidatePath("/settings");
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
