"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getStudentAccess, type StudentAccess } from "@/lib/auth/student-session";
import { itemsForStudentWhere } from "@/lib/tracker/data";
import { acceptTickDay, addDays, shownOn, TRACKER_LIMITS, validateDays, validateTitle } from "@/lib/tracker/rules";

// The student's side of the daily tracker. Every action re-checks her
// session, that the course has the tracker on, and that the item reaches
// her. Ticks: only her local today or yesterday, only on a day the item
// applies to. Her own items wait for staff approval (D8/D9).

export type TrackerStudentResult = { error?: string };

const OFF = { error: "جدول المتابعة غير متاح حاليًا" };

async function trackerStudent(): Promise<StudentAccess | null> {
  const access = await getStudentAccess();
  return access && access.trackerEnabled ? access : null;
}

const day = (d: Date) => d.toISOString().slice(0, 10);

function refresh() {
  revalidatePath("/student/tracker");
}

/** Tick (on) or untick an item for today or yesterday. today = her browser's local date. */
export async function setTrackerCheckAction(input: { itemId: string; day: string; today: string; on: boolean }): Promise<TrackerStudentResult> {
  const access = await trackerStudent();
  if (!access) return OFF;
  const d = acceptTickDay(input?.day, input?.today);
  if (!d) return { error: "يمكن التعليم لليوم أو الأمس فقط — يُرجى تحديث الصفحة" };
  const item = await prisma.trackerItem.findFirst({
    where: { id: String(input?.itemId ?? ""), ...itemsForStudentWhere({ id: access.studentId, courseId: access.courseId, groupId: access.groupId }) },
    select: { id: true, value: true, status: true, days: true, createdAt: true, archivedAt: true },
  });
  // her browser counts an item from its LOCAL creation day (withLocalDays);
  // the server only knows UTC, so it allows a day of slack either side —
  // this only gates ticking, scores are always computed from local days
  const scored = item && {
    ...item,
    createdDay: addDays(day(item.createdAt), -1),
    archivedDay: item.archivedAt ? addDays(day(item.archivedAt), 1) : null,
  };
  if (!scored || !shownOn(scored, d)) return { error: "هذا البند غير متاح لهذا اليوم" };

  const dayDate = new Date(`${d}T00:00:00Z`);
  if (input.on === true) {
    await prisma.trackerCheck.upsert({
      where: { itemId_studentId_day: { itemId: scored.id, studentId: access.studentId, day: dayDate } },
      create: { itemId: scored.id, studentId: access.studentId, day: dayDate },
      update: {},
    });
  } else {
    await prisma.trackerCheck.deleteMany({ where: { itemId: scored.id, studentId: access.studentId, day: dayDate } });
  }
  refresh();
  return {};
}

/** «+ بند خاص»: waits for approval; staff set its score (D7: at most 10 of her own). */
export async function addOwnTrackerItemAction(input: { title: string; days: number }): Promise<TrackerStudentResult> {
  const access = await trackerStudent();
  if (!access) return OFF;
  const t = validateTitle(input?.title);
  if ("error" in t) return { error: t.error };
  const days = validateDays(input?.days);
  if (days === null) return { error: "يُرجى اختيار يوم واحد على الأقل" };
  const own = await prisma.trackerItem.count({
    where: { createdByStudentId: access.studentId, archivedAt: null, status: { not: "REJECTED" } },
  });
  if (own >= TRACKER_LIMITS.ownItemsPerStudent) {
    return { error: `يمكن إضافة ${TRACKER_LIMITS.ownItemsPerStudent} بنود خاصة على الأكثر` };
  }
  await prisma.trackerItem.create({
    data: { courseId: access.courseId, title: t.title, days, status: "PENDING", value: null, createdByStudentId: access.studentId },
  });
  refresh();
  return {};
}

/** D9: she edits her own item's title only while it's pending. */
export async function renameOwnTrackerItemAction(itemId: string, title: string): Promise<TrackerStudentResult> {
  const access = await trackerStudent();
  if (!access) return OFF;
  const t = validateTitle(title);
  if ("error" in t) return { error: t.error };
  const { count } = await prisma.trackerItem.updateMany({
    where: { id: String(itemId ?? ""), createdByStudentId: access.studentId, status: "PENDING", archivedAt: null },
    data: { title: t.title },
  });
  if (count === 0) return { error: "يمكن تعديل البند ما دام بانتظار الاعتماد فقط" };
  refresh();
  return {};
}

/** D8: she may delete her own pending or rejected item (approved ones are staff's to archive). */
export async function deleteOwnTrackerItemAction(itemId: string): Promise<TrackerStudentResult> {
  const access = await trackerStudent();
  if (!access) return OFF;
  const { count } = await prisma.trackerItem.deleteMany({
    where: { id: String(itemId ?? ""), createdByStudentId: access.studentId, status: { in: ["PENDING", "REJECTED"] } },
  });
  if (count === 0) return { error: "لا يمكن حذف هذا البند" };
  refresh();
  return {};
}
