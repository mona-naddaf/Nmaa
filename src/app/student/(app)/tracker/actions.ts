"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getStudentAccess, type StudentAccess } from "@/lib/auth/student-session";
import { itemsForStudentWhere } from "@/lib/tracker/data";
import { acceptCourseTickDay, shownOn, TRACKER_LIMITS, validateDays, validateTitle } from "@/lib/tracker/rules";
import { courseTimeZone } from "@/lib/time/course-zone";
import { dateOnly, zoneDayOf, zoneToday } from "@/lib/time/zone";
import { setStudentItemSchedule, setStudentOrder, type ScheduleChoice } from "@/lib/tracker/agenda-data";
import { validateSchedule } from "@/lib/tracker/schedule";
import { coursePlace } from "@/lib/prayer/place-data";
import { courseSummary, type SummaryPayload } from "@/lib/tracker/summary-data";
import { clampOffset, isPeriodKind } from "@/lib/tracker/summary";

// The student's side of the daily tracker. Every action re-checks her
// session, that the course has the tracker on, and that the item reaches
// her. Ticks: only the course's today or yesterday (its time zone,
// lib/time/zone.ts), only on a day the item applies to. Her own items wait for staff approval (D8/D9).

export type TrackerStudentResult = { error?: string };

const OFF = { error: "جدول المتابعة غير متاح حاليًا" };
const AGENDA_OFF = { error: "الجدول اليومي غير متاح حاليًا" };

async function trackerStudent(): Promise<StudentAccess | null> {
  const access = await getStudentAccess();
  return access && access.trackerEnabled ? access : null;
}

/** «الجدول اليومي» needs the tracker and its own switch. */
async function agendaStudent(): Promise<StudentAccess | null> {
  const access = await trackerStudent();
  return access && access.trackerAgendaEnabled ? access : null;
}

const ref = (a: StudentAccess) => ({ id: a.studentId, courseId: a.courseId, groupId: a.groupId });

function refresh() {
  revalidatePath("/student/tracker");
}

/** Tick (on) or untick an item for today or yesterday (the course's days; input.today is not used). */
export async function setTrackerCheckAction(input: { itemId: string; day: string; today: string; on: boolean }): Promise<TrackerStudentResult> {
  const access = await trackerStudent();
  if (!access) return OFF;
  const timeZone = await courseTimeZone(access.courseId);
  const d = acceptCourseTickDay(input?.day, zoneToday(timeZone));
  if (!d) return { error: "يمكن التعليم لليوم أو الأمس فقط — يُرجى تحديث الصفحة" };
  const item = await prisma.trackerItem.findFirst({
    where: { id: String(input?.itemId ?? ""), ...itemsForStudentWhere({ id: access.studentId, courseId: access.courseId, groupId: access.groupId }) },
    select: { id: true, value: true, status: true, days: true, createdAt: true, archivedAt: true },
  });
  // an item exists from the course's day it was created, as her page shows it (withLocalDays)
  const scored = item && {
    ...item,
    createdDay: zoneDayOf(timeZone, item.createdAt),
    archivedDay: item.archivedAt ? zoneDayOf(timeZone, item.archivedAt) : null,
  };
  if (!scored || !shownOn(scored, d)) return { error: "هذا البند غير متاح لهذا اليوم" };

  const dayDate = dateOnly(d);
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

/**
 * «+ بند خاص»: waits for approval; staff set its score (D7: at most 10 of
 * her own). With «الجدول اليومي» on she may give it a schedule straight away.
 */
export async function addOwnTrackerItemAction(input: { title: string; days: number; schedule?: ScheduleChoice }): Promise<TrackerStudentResult> {
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
  // a schedule only with «الجدول اليومي» on; checked before the item is saved
  const schedule = access.trackerAgendaEnabled && Array.isArray(input?.schedule) ? input.schedule : null;
  const anchors = schedule ? (await coursePlace(access.courseId)) !== null : false;
  if (schedule && !validateSchedule(schedule, anchors)) return { error: "الوقت غير صحيح" };
  const item = await prisma.trackerItem.create({
    data: { courseId: access.courseId, title: t.title, days, status: "PENDING", value: null, createdByStudentId: access.studentId },
    select: { id: true },
  });
  if (schedule) await setStudentItemSchedule(ref(access), item.id, schedule, anchors);
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

/**
 * D8: she may delete her own pending or rejected item. An approved own item
 * is archived instead («الجدول اليومي»): it stops counting from today and
 * its past days keep their scores. Staff's items are never hers to remove.
 */
export async function deleteOwnTrackerItemAction(itemId: string): Promise<TrackerStudentResult> {
  const access = await trackerStudent();
  if (!access) return OFF;
  const id = String(itemId ?? "");
  const { count } = await prisma.trackerItem.deleteMany({
    where: { id, createdByStudentId: access.studentId, status: { in: ["PENDING", "REJECTED"] } },
  });
  if (count === 0) {
    const archived = await prisma.trackerItem.updateMany({
      where: { id, createdByStudentId: access.studentId, status: "APPROVED", archivedAt: null },
      data: { archivedAt: new Date() },
    });
    if (archived.count === 0) return { error: "لا يمكن حذف هذا البند" };
  }
  refresh();
  return {};
}

// ---------- «المحصّلات» ----------

/** Her own summary for a period (the course has the tracker and the summaries on). */
export async function mySummaryAction(kind: unknown, offset: unknown): Promise<SummaryPayload | { error: string }> {
  const access = await trackerStudent();
  if (!access || !access.trackerSummaryEnabled) return { error: "المحصّلات غير متاحة حاليًا" };
  if (!isPeriodKind(kind)) return { error: "فترة غير صحيحة" };
  return courseSummary(access.studentId, kind, clampOffset(offset));
}

// ---------- «الجدول اليومي» ----------

/** Her own schedule for an item reaching her, or back to staff's ("STAFF"). */
export async function setMyItemScheduleAction(itemId: string, schedule: ScheduleChoice): Promise<TrackerStudentResult> {
  const access = await agendaStudent();
  if (!access) return AGENDA_OFF;
  const r = await setStudentItemSchedule(ref(access), itemId, schedule, (await coursePlace(access.courseId)) !== null);
  if (!r.error) refresh();
  return r;
}

/** Her personal order of the items reaching her. */
export async function setMyOrderAction(itemIds: string[]): Promise<TrackerStudentResult> {
  const access = await agendaStudent();
  if (!access) return AGENDA_OFF;
  const r = await setStudentOrder(ref(access), itemIds);
  if (!r.error) refresh();
  return r;
}
