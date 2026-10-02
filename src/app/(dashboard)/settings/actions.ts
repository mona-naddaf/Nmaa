"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/require";
import { generateUniqueBoardCode } from "@/lib/auth/board-code";
import { pickByGroup, studentsNoun, type GroupGender } from "@/lib/text/gender";
import { validateTargets, type HomeTargets } from "@/lib/home-log/rules";
import { ensureBuiltinFields, getCourseInfoFields } from "@/lib/students/extra-info";
import {
  BUILTIN_ORDER,
  MAX_CUSTOM_FIELDS,
  MAX_LABEL_LENGTH,
  builtinLabel,
  infoLabelKey,
} from "@/lib/students/extra-info-rules";
import { FIXED_HEADERS, nameHeader } from "@/lib/students/import-template";

async function currentCourseId() {
  return (await requireAdmin()).courseId;
}

export async function setAddStudentsPermissionAction(value: "ADMIN_ONLY" | "ALL_TEACHERS") {
  const cid = await currentCourseId();
  await prisma.course.update({ where: { id: cid }, data: { addStudentsPermission: value } });
  revalidatePath("/settings");
}

const STUDENT_PERMISSION_FIELDS = ["editStudentsPermission", "archiveStudentsPermission", "issueStudentCodesPermission"] as const;
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

// ---------- Student login ----------

// Turning login off ends every open student session on its next request
// (src/lib/auth/student-session.ts); codes are kept for when it's back on.
export async function setStudentLoginEnabledAction(enabled: boolean) {
  const cid = await currentCourseId();
  await prisma.course.update({ where: { id: cid }, data: { studentLoginEnabled: enabled === true } });
  revalidatePath("/", "layout");
}

export async function setStudentBoardEnabledAction(enabled: boolean): Promise<{ error?: string }> {
  const cid = await currentCourseId();
  const course = await prisma.course.findUniqueOrThrow({ where: { id: cid }, select: { studentLoginEnabled: true } });
  if (enabled && !course.studentLoginEnabled) return { error: "يُرجى تفعيل دخول الطلاب أولًا" };
  await prisma.course.update({ where: { id: cid }, data: { studentBoardEnabled: enabled === true } });
  revalidatePath("/", "layout");
  return {};
}

// Home memorization log: needs student login on. Turning it off hides the
// tab and refuses its actions; segments and taps are kept.
export async function setHomeLogEnabledAction(enabled: boolean): Promise<{ error?: string }> {
  const cid = await currentCourseId();
  const course = await prisma.course.findUniqueOrThrow({ where: { id: cid }, select: { studentLoginEnabled: true } });
  if (enabled && !course.studentLoginEnabled) return { error: "يُرجى تفعيل دخول الطلاب أولًا" };
  await prisma.course.update({ where: { id: cid }, data: { homeLogEnabled: enabled === true } });
  revalidatePath("/", "layout");
  return {};
}

// Assignments and the daily tracker: each needs student login on. Turning
// one off hides its tab and staff page and refuses its actions; nothing is
// deleted, so turning it back on brings everything back.
const STUDENT_FEATURE_FIELDS = { assignments: "assignmentsEnabled", tracker: "trackerEnabled" } as const;

export async function setStudentFeatureEnabledAction(
  feature: keyof typeof STUDENT_FEATURE_FIELDS,
  enabled: boolean,
): Promise<{ error?: string }> {
  const cid = await currentCourseId();
  if (!Object.hasOwn(STUDENT_FEATURE_FIELDS, feature)) return { error: "إعداد غير معروف" };
  const field = STUDENT_FEATURE_FIELDS[feature];
  const course = await prisma.course.findUniqueOrThrow({ where: { id: cid }, select: { studentLoginEnabled: true } });
  if (enabled && !course.studentLoginEnabled) return { error: "يُرجى تفعيل دخول الطلاب أولًا" };
  await prisma.course.update({ where: { id: cid }, data: { [field]: enabled === true } });
  revalidatePath("/", "layout");
  return {};
}

/** Defaults for new segments (students with their own targets keep them). */
export async function setHomeDefaultTargetsAction(targets: HomeTargets): Promise<{ error?: string }> {
  const cid = await currentCourseId();
  const t = validateTargets(targets);
  if (!t) return { error: "يُرجى إدخال أهداف صحيحة بين 1 و100" };
  await prisma.course.update({
    where: { id: cid },
    data: { homeTargetListen: t.listen, homeTargetRepeat: t.repeat, homeTargetRecite: t.recite },
  });
  revalidatePath("/settings");
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

// ---------- Extra student information («معلومات إضافية») ----------

// Shown on student pages, the edit form and the parent portal, so refresh
// the whole app. Turning the feature (or a field) off only hides: stored
// values are kept for when it's back on.
function refreshStudentInfoEverywhere() {
  revalidatePath("/", "layout");
}

export async function setStudentInfoEnabledAction(enabled: boolean) {
  const cid = await currentCourseId();
  if (enabled === true) await ensureBuiltinFields(cid);
  await prisma.course.update({ where: { id: cid }, data: { studentInfoEnabled: enabled === true } });
  refreshStudentInfoEverywhere();
}

export async function setParentStudentInfoEditAction(enabled: boolean): Promise<{ error?: string }> {
  const cid = await currentCourseId();
  const course = await prisma.course.findUniqueOrThrow({ where: { id: cid }, select: { studentInfoEnabled: true } });
  if (enabled && !course.studentInfoEnabled) return { error: "يُرجى تفعيل المعلومات الإضافية أولًا" };
  await prisma.course.update({ where: { id: cid }, data: { parentStudentInfoEdit: enabled === true } });
  refreshStudentInfoEverywhere();
  return {};
}

const INFO_FIELD_FLAGS = ["enabled", "required", "visibleToTeachers", "visibleToParents"] as const;
export type InfoFieldFlag = (typeof INFO_FIELD_FLAGS)[number];

export async function setInfoFieldFlagAction(fieldId: string, flag: InfoFieldFlag, value: boolean): Promise<{ error?: string }> {
  const cid = await currentCourseId();
  if (!INFO_FIELD_FLAGS.includes(flag)) return { error: "إعداد غير معروف" };
  const { count } = await prisma.studentInfoField.updateMany({
    where: { id: String(fieldId), courseId: cid },
    data: { [flag]: value === true },
  });
  if (count === 0) return { error: "الحقل غير موجود" };
  refreshStudentInfoEverywhere();
  return {};
}

// Names every column of the import template already uses, so a custom
// field can't be confused with one of them when a file is read back.
const RESERVED_LABEL_KEYS = new Set(
  [
    ...FIXED_HEADERS,
    nameHeader("girls"),
    nameHeader("boys"),
    ...BUILTIN_ORDER.flatMap((k) => [builtinLabel(k, "GIRLS"), builtinLabel(k, "BOYS"), builtinLabel(k, null)]),
  ].map(infoLabelKey),
);

async function checkCustomLabel(courseId: string, label: string, exceptFieldId?: string): Promise<{ error: string } | { label: string }> {
  const trimmed = label.replace(/\s+/g, " ").trim();
  const key = infoLabelKey(trimmed);
  if (!key) return { error: "يُرجى إدخال اسم الحقل" };
  if (trimmed.includes("*")) return { error: "لا يمكن أن يحتوي اسم الحقل على «*»" };
  if (trimmed.length > MAX_LABEL_LENGTH) return { error: `اسم الحقل أطول من الحد المسموح (${MAX_LABEL_LENGTH} حرفًا)` };
  if (RESERVED_LABEL_KEYS.has(key)) return { error: "هذا الاسم مستخدم لحقل أساسي أو لعمود في قالب الاستيراد" };
  const others = await prisma.studentInfoField.findMany({
    where: { courseId, builtinKey: null, ...(exceptFieldId ? { id: { not: exceptFieldId } } : {}) },
    select: { label: true },
  });
  if (others.some((o) => infoLabelKey(o.label ?? "") === key)) return { error: "يوجد حقل آخر بهذا الاسم" };
  return { label: trimmed };
}

/** A new custom field starts enabled (she just asked for it), optional, shown to all. */
export async function addCustomInfoFieldAction(label: string): Promise<{ error?: string }> {
  const cid = await currentCourseId();
  const checked = await checkCustomLabel(cid, String(label ?? ""));
  if ("error" in checked) return checked;
  const fields = await getCourseInfoFields(cid);
  if (fields.filter((f) => f.builtinKey === null).length >= MAX_CUSTOM_FIELDS) {
    return { error: `لا يمكن إضافة أكثر من ${MAX_CUSTOM_FIELDS} حقلًا خاصًّا` };
  }
  const sortOrder = fields.reduce((max, f) => Math.max(max, f.sortOrder + 1), 0);
  await prisma.studentInfoField.create({ data: { courseId: cid, label: checked.label, enabled: true, sortOrder } });
  refreshStudentInfoEverywhere();
  return {};
}

export async function renameCustomInfoFieldAction(fieldId: string, label: string): Promise<{ error?: string }> {
  const cid = await currentCourseId();
  const field = await prisma.studentInfoField.findFirst({
    where: { id: String(fieldId), courseId: cid, builtinKey: null },
    select: { id: true },
  });
  if (!field) return { error: "الحقل غير موجود" };
  const checked = await checkCustomLabel(cid, String(label ?? ""), field.id);
  if ("error" in checked) return checked;
  await prisma.studentInfoField.update({ where: { id: field.id }, data: { label: checked.label } });
  refreshStudentInfoEverywhere();
  return {};
}

/** Swaps a field with its neighbour (renumbering the whole list 0…n-1). */
export async function moveInfoFieldAction(fieldId: string, direction: "up" | "down"): Promise<{ error?: string }> {
  const cid = await currentCourseId();
  const ids = (await getCourseInfoFields(cid)).map((f) => f.id);
  const i = ids.indexOf(String(fieldId));
  if (i === -1) return { error: "الحقل غير موجود" };
  const j = direction === "up" ? i - 1 : i + 1;
  if (j < 0 || j >= ids.length) return {};
  [ids[i], ids[j]] = [ids[j], ids[i]];
  await prisma.$transaction(
    ids.map((id, sortOrder) => prisma.studentInfoField.update({ where: { id }, data: { sortOrder } })),
  );
  refreshStudentInfoEverywhere();
  return {};
}

export type DeleteInfoFieldResult = { error?: string; valuesToDelete?: number };

// Deleting a custom field deletes every student's value in it (archived
// students included). When there are any, the first call only reports how
// many; the caller confirms and calls again with confirmed = true.
export async function deleteCustomInfoFieldAction(fieldId: string, confirmed = false): Promise<DeleteInfoFieldResult> {
  const cid = await currentCourseId();
  const field = await prisma.studentInfoField.findFirst({
    where: { id: String(fieldId), courseId: cid, builtinKey: null },
    select: { id: true, _count: { select: { values: true } } },
  });
  if (!field) return { error: "الحقل غير موجود" };
  if (field._count.values > 0 && confirmed !== true) return { valuesToDelete: field._count.values };
  await prisma.studentInfoField.delete({ where: { id: field.id } });
  refreshStudentInfoEverywhere();
  return {};
}
