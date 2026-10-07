"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getRafiqUser } from "@/lib/rafiq/session";
import { addDays, isValidIso, toHijri } from "@/lib/calendar/hijri";
import { adjustableYears, isOccasion, isOptionalOccasion, MAX_ADJUSTMENT_DAYS, OPTIONAL_OCCASIONS } from "@/lib/calendar/occasions";

// Her calendar: the same rules as a course calendar (src/app/(dashboard)/
// calendar/actions.ts), on her own rows only. She manages everything in it,
// including moon-sighting adjustments.

export type CalendarResult = { error?: string };

const SIGNED_OUT = { error: "انتهت الجلسة، يُرجى تسجيل الدخول مرة أخرى" };
const TITLE_MAX = 80;
const DESCRIPTION_MAX = 500;
const DAYS_MAX = 300;

function refresh() {
  revalidatePath("/rafiq/calendar");
}

type DayInput = { title: string; date: string; description: string };

function clean(input: DayInput): { error: string } | { title: string; date: Date; description: string | null } {
  const title = String(input?.title ?? "").trim();
  const description = String(input?.description ?? "").trim();
  const date = String(input?.date ?? "");
  if (!title) return { error: "يُرجى إدخال عنوان اليوم الخاص" };
  if (title.length > TITLE_MAX) return { error: `يُرجى ألّا يتجاوز العنوان ${TITLE_MAX} حرفًا` };
  if (description.length > DESCRIPTION_MAX) return { error: `يُرجى ألّا يتجاوز الوصف ${DESCRIPTION_MAX} حرف` };
  if (!isValidIso(date)) return { error: "يُرجى اختيار تاريخ صحيح" };
  return { title, date: new Date(`${date}T00:00:00Z`), description: description || null };
}

export async function createDayAction(input: DayInput): Promise<CalendarResult> {
  const user = await getRafiqUser();
  if (!user) return SIGNED_OUT;
  const fields = clean(input);
  if ("error" in fields) return fields;
  const count = await prisma.rafiqCalendarDay.count({ where: { userId: user.id } });
  if (count >= DAYS_MAX) return { error: `يمكن إضافة ${DAYS_MAX} يوم خاص على الأكثر` };
  await prisma.rafiqCalendarDay.create({ data: { userId: user.id, ...fields } });
  refresh();
  return {};
}

export async function updateDayAction(id: string, input: DayInput): Promise<CalendarResult> {
  const user = await getRafiqUser();
  if (!user) return SIGNED_OUT;
  const fields = clean(input);
  if ("error" in fields) return fields;
  const { count } = await prisma.rafiqCalendarDay.updateMany({ where: { id: String(id ?? ""), userId: user.id }, data: fields });
  if (count === 0) return { error: "هذا اليوم غير موجود" };
  refresh();
  return {};
}

export async function deleteDayAction(id: string): Promise<CalendarResult> {
  const user = await getRafiqUser();
  if (!user) return SIGNED_OUT;
  const { count } = await prisma.rafiqCalendarDay.deleteMany({ where: { id: String(id ?? ""), userId: user.id } });
  if (count === 0) return { error: "هذا اليوم غير موجود" };
  refresh();
  return {};
}

export async function setOptionalOccasionAction(occasion: string, enabled: boolean): Promise<CalendarResult> {
  const user = await getRafiqUser();
  if (!user) return SIGNED_OUT;
  if (!isOptionalOccasion(occasion)) return { error: "مناسبة غير معروفة" };
  const { enabledOccasions } = await prisma.rafiqUser.findUniqueOrThrow({ where: { id: user.id }, select: { enabledOccasions: true } });
  const next = new Set(enabledOccasions);
  if (enabled) next.add(occasion);
  else next.delete(occasion);
  // keep catalog order, and only ever optional presets
  await prisma.rafiqUser.update({ where: { id: user.id }, data: { enabledOccasions: OPTIONAL_OCCASIONS.filter((o) => next.has(o)) } });
  refresh();
  return {};
}

/** Shifts one year's occurrence of an occasion by ±1/±2 days for her, or 0 to remove the shift. */
export async function setAdjustmentAction(occasion: string, hijriYear: number, offsetDays: number): Promise<CalendarResult> {
  const user = await getRafiqUser();
  if (!user) return SIGNED_OUT;
  if (!isOccasion(occasion)) return { error: "مناسبة غير معروفة" };
  if (!Number.isInteger(offsetDays) || Math.abs(offsetDays) > MAX_ADJUSTMENT_DAYS) {
    return { error: "يمكن تعديل الموعد بيوم أو يومين فقط" };
  }
  // her browser decides "today" and may be a day off the server's UTC day
  const utcToday = new Date().toISOString().slice(0, 10);
  const allowed = new Set([-1, 0, 1].flatMap((d) => adjustableYears(toHijri(addDays(utcToday, d)).year)));
  if (!allowed.has(hijriYear)) return { error: "يمكن تعديل الموعد الحالي والقادم فقط" };

  if (offsetDays === 0) {
    await prisma.rafiqCalendarAdjustment.deleteMany({ where: { userId: user.id, occasion, hijriYear } });
  } else {
    await prisma.rafiqCalendarAdjustment.upsert({
      where: { userId_occasion_hijriYear: { userId: user.id, occasion, hijriYear } },
      update: { offsetDays },
      create: { userId: user.id, occasion, hijriYear, offsetDays },
    });
  }
  refresh();
  return {};
}
