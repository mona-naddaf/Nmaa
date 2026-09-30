"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth/require";
import { canEditEvent, canManageCalendar } from "@/lib/calendar/data";
import { addDays, isValidIso, toHijri } from "@/lib/calendar/hijri";
import {
  adjustableYears,
  isOccasion,
  isOptionalOccasion,
  MAX_ADJUSTMENT_DAYS,
  OPTIONAL_OCCASIONS,
} from "@/lib/calendar/occasions";

export type CalendarActionResult = { error?: string };

const TITLE_MAX = 80;
const DESCRIPTION_MAX = 500;

// Every action re-checks the session and that the course has the calendar
// on — hiding the UI is never the only guard.
async function calendarContext() {
  const session = await requireSession();
  const course = await prisma.course.findUniqueOrThrow({
    where: { id: session.courseId },
    select: { calendarEnabled: true, calendarEditPermission: true, enabledOccasions: true },
  });
  return { session, course };
}

function refresh() {
  revalidatePath("/calendar");
  revalidatePath("/students");
}

type EventInput = { title: string; date: string; description: string };

function cleanEventInput(input: EventInput): { error: string } | { title: string; date: Date; description: string | null } {
  const title = String(input.title ?? "").trim();
  const description = String(input.description ?? "").trim();
  const date = String(input.date ?? "");
  if (!title) return { error: "يُرجى إدخال عنوان الفعالية" };
  if (title.length > TITLE_MAX) return { error: `يُرجى ألّا يتجاوز العنوان ${TITLE_MAX} حرفًا` };
  if (description.length > DESCRIPTION_MAX) return { error: `يُرجى ألّا يتجاوز الوصف ${DESCRIPTION_MAX} حرف` };
  if (!isValidIso(date)) return { error: "يُرجى اختيار تاريخ صحيح" };
  return { title, date: new Date(`${date}T00:00:00Z`), description: description || null };
}

export async function createEventAction(input: EventInput): Promise<CalendarActionResult> {
  const { session, course } = await calendarContext();
  if (!course.calendarEnabled) return { error: "التقويم غير مفعّل في هذه الدورة" };
  if (!canManageCalendar(session, course.calendarEditPermission)) {
    return { error: "ليست لديك صلاحية إضافة الفعاليات" };
  }
  const clean = cleanEventInput(input);
  if ("error" in clean) return clean;

  await prisma.calendarEvent.create({
    data: {
      courseId: session.courseId,
      ...clean,
      // null = the supervisor (see CalendarEvent.createdByTeacherId)
      createdByTeacherId: session.role === "teacher" ? session.teacherId : null,
    },
  });
  refresh();
  return {};
}

async function findEditableEvent(eventId: string) {
  const { session, course } = await calendarContext();
  if (!course.calendarEnabled) return { error: "التقويم غير مفعّل في هذه الدورة" } as const;
  const event = await prisma.calendarEvent.findFirst({
    where: { id: eventId, courseId: session.courseId },
    select: { id: true, createdByTeacherId: true },
  });
  if (!event) return { error: "الفعالية غير موجودة" } as const;
  if (!canEditEvent(session, course.calendarEditPermission, event.createdByTeacherId)) {
    return { error: "ليست لديك صلاحية تعديل هذه الفعالية" } as const;
  }
  return { session, event } as const;
}

export async function updateEventAction(eventId: string, input: EventInput): Promise<CalendarActionResult> {
  const found = await findEditableEvent(eventId);
  if ("error" in found) return { error: found.error };
  const clean = cleanEventInput(input);
  if ("error" in clean) return clean;

  // the ownership check is repeated in the WHERE, so a concurrent change of
  // ownership can't slip an edit through between the read and the write
  const { count } = await prisma.calendarEvent.updateMany({
    where: {
      id: found.event.id,
      courseId: found.session.courseId,
      createdByTeacherId: found.event.createdByTeacherId,
    },
    data: clean,
  });
  if (count === 0) return { error: "تعذّر حفظ التعديل، يُرجى إعادة المحاولة" };
  refresh();
  return {};
}

export async function deleteEventAction(eventId: string): Promise<CalendarActionResult> {
  const found = await findEditableEvent(eventId);
  if ("error" in found) return { error: found.error };
  await prisma.calendarEvent.deleteMany({
    where: {
      id: found.event.id,
      courseId: found.session.courseId,
      createdByTeacherId: found.event.createdByTeacherId,
    },
  });
  refresh();
  return {};
}

export async function setOptionalOccasionAction(occasion: string, enabled: boolean): Promise<CalendarActionResult> {
  const { session, course } = await calendarContext();
  if (!course.calendarEnabled) return { error: "التقويم غير مفعّل في هذه الدورة" };
  if (!canManageCalendar(session, course.calendarEditPermission)) {
    return { error: "ليست لديك صلاحية تعديل المناسبات" };
  }
  if (!isOptionalOccasion(occasion)) return { error: "مناسبة غير معروفة" };

  const next = new Set(course.enabledOccasions);
  if (enabled) next.add(occasion);
  else next.delete(occasion);
  await prisma.course.update({
    where: { id: session.courseId },
    // keep catalog order, and only ever optional presets
    data: { enabledOccasions: OPTIONAL_OCCASIONS.filter((o) => next.has(o)) },
  });
  refresh();
  return {};
}

// Supervisor only (regardless of the edit permission): shift one year's
// occurrence of an occasion by ±1/±2 days, or 0 to remove the shift.
export async function setAdjustmentAction(
  occasion: string,
  hijriYear: number,
  offsetDays: number,
): Promise<CalendarActionResult> {
  const { session, course } = await calendarContext();
  if (!course.calendarEnabled) return { error: "التقويم غير مفعّل في هذه الدورة" };
  if (session.role !== "admin") return { error: "تعديل مواعيد المناسبات من صلاحيات الإشراف فقط" };
  if (!isOccasion(occasion)) return { error: "مناسبة غير معروفة" };
  if (!Number.isInteger(offsetDays) || Math.abs(offsetDays) > MAX_ADJUSTMENT_DAYS) {
    return { error: "يمكن تعديل الموعد بيوم أو يومين فقط" };
  }

  // The browser decides "today", and may be up to a day ahead of or behind
  // the server's UTC day; accept the adjustable years of either side.
  const utcToday = new Date().toISOString().slice(0, 10);
  const allowed = new Set(
    [-1, 0, 1].flatMap((d) => adjustableYears(toHijri(addDays(utcToday, d)).year)),
  );
  if (!allowed.has(hijriYear)) return { error: "يمكن تعديل الموعد الحالي والقادم فقط" };

  const key = { courseId_occasion_hijriYear: { courseId: session.courseId, occasion, hijriYear } };
  if (offsetDays === 0) {
    await prisma.calendarAdjustment.deleteMany({ where: { courseId: session.courseId, occasion, hijriYear } });
  } else {
    await prisma.calendarAdjustment.upsert({
      where: key,
      update: { offsetDays },
      create: { courseId: session.courseId, occasion, hijriYear, offsetDays },
    });
  }
  refresh();
  return {};
}
