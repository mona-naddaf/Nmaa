"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getRafiqUser } from "@/lib/rafiq/session";
import { acceptTickDay, addDays, shownOn, validateDays, validateTitle, validateValue } from "@/lib/tracker/rules";
import { RAFIQ_TRACKER_MAX_ITEMS } from "@/lib/rafiq/rules";

// Her own follow-up tracker: she creates, edits and removes her items (no
// approval), and ticks today or yesterday only. Every action re-checks her
// session and that the item is hers.

export type TrackerResult = { error?: string };

const SIGNED_OUT = { error: "انتهت الجلسة، يُرجى تسجيل الدخول مرة أخرى" };

const day = (d: Date) => d.toISOString().slice(0, 10);

function refresh() {
  revalidatePath("/rafiq/tracker");
}

type ItemInput = { title: string; value: number; days: number };

function checkFields(input: ItemInput): { error: string } | { title: string; value: number; days: number } {
  const t = validateTitle(input?.title);
  if ("error" in t) return { error: t.error };
  const value = validateValue(input?.value);
  if (value === null) return { error: "يُرجى اختيار درجة من 1 إلى 10" };
  const days = validateDays(input?.days);
  if (days === null) return { error: "يُرجى اختيار يوم واحد على الأقل" };
  return { title: t.title, value, days };
}

export async function addItemAction(input: ItemInput): Promise<TrackerResult> {
  const user = await getRafiqUser();
  if (!user) return SIGNED_OUT;
  const fields = checkFields(input);
  if ("error" in fields) return { error: fields.error };
  const active = await prisma.rafiqTrackerItem.count({ where: { userId: user.id, archivedAt: null } });
  if (active >= RAFIQ_TRACKER_MAX_ITEMS) return { error: `يمكن أن يضم الجدول ${RAFIQ_TRACKER_MAX_ITEMS} بندًا على الأكثر` };
  await prisma.rafiqTrackerItem.create({ data: { userId: user.id, ...fields } });
  refresh();
  return {};
}

/** Editing a mark or its days also re-scores past days (as in courses). */
export async function updateItemAction(id: string, input: ItemInput): Promise<TrackerResult> {
  const user = await getRafiqUser();
  if (!user) return SIGNED_OUT;
  const fields = checkFields(input);
  if ("error" in fields) return { error: fields.error };
  const { count } = await prisma.rafiqTrackerItem.updateMany({ where: { id: String(id ?? ""), userId: user.id, archivedAt: null }, data: fields });
  if (count === 0) return { error: "هذا البند غير موجود" };
  refresh();
  return {};
}

/** Removes it from today on; earlier days keep it and their ticks. */
export async function removeItemAction(id: string): Promise<TrackerResult> {
  const user = await getRafiqUser();
  if (!user) return SIGNED_OUT;
  const { count } = await prisma.rafiqTrackerItem.updateMany({
    where: { id: String(id ?? ""), userId: user.id, archivedAt: null },
    data: { archivedAt: new Date() },
  });
  if (count === 0) return { error: "هذا البند غير موجود" };
  refresh();
  return {};
}

/** Tick (on) or untick an item for her today or yesterday. today = her browser's local date. */
export async function setCheckAction(input: { itemId: string; day: string; today: string; on: boolean }): Promise<TrackerResult> {
  const user = await getRafiqUser();
  if (!user) return SIGNED_OUT;
  const d = acceptTickDay(input?.day, input?.today);
  if (!d) return { error: "يمكن التعليم لليوم أو الأمس فقط — يُرجى تحديث الصفحة" };
  const item = await prisma.rafiqTrackerItem.findFirst({
    where: { id: String(input?.itemId ?? ""), userId: user.id },
    select: { id: true, value: true, days: true, createdAt: true, archivedAt: true },
  });
  // her browser counts an item from its LOCAL creation day; the server only
  // knows UTC, so it allows a day of slack either side (as in courses)
  const scored = item && {
    ...item,
    status: "APPROVED" as const,
    createdDay: addDays(day(item.createdAt), -1),
    archivedDay: item.archivedAt ? addDays(day(item.archivedAt), 1) : null,
  };
  if (!scored || !shownOn(scored, d)) return { error: "هذا البند غير متاح لهذا اليوم" };

  const dayDate = new Date(`${d}T00:00:00Z`);
  if (input.on === true) {
    await prisma.rafiqTrackerCheck.upsert({
      where: { itemId_day: { itemId: scored.id, day: dayDate } },
      create: { itemId: scored.id, userId: user.id, day: dayDate },
      update: {},
    });
  } else {
    await prisma.rafiqTrackerCheck.deleteMany({ where: { itemId: scored.id, userId: user.id, day: dayDate } });
  }
  refresh();
  return {};
}
