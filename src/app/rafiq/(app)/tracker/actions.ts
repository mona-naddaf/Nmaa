"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getRafiqUser } from "@/lib/rafiq/session";
import { acceptTickDay, addDays, shownOn, validateDays, validateTitle, validateValue } from "@/lib/tracker/rules";
import { RAFIQ_TRACKER_MAX_ITEMS } from "@/lib/rafiq/rules";
import { nextRafiqSortOrder, setRafiqItemTime, setRafiqOrder } from "@/lib/tracker/agenda-data";
import { validateTime, type AgendaTime } from "@/lib/tracker/agenda";
import { rafiqSummary, type SummaryPayload } from "@/lib/tracker/summary-data";
import { clampOffset, isPeriodKind } from "@/lib/tracker/summary";

// Her own follow-up tracker: she creates, edits and removes her items (no
// approval), and ticks today or yesterday only. Every action re-checks her
// session and that the item is hers.

export type TrackerResult = { error?: string };

const SIGNED_OUT = { error: "انتهت الجلسة، يُرجى تسجيل الدخول مرة أخرى" };

const day = (d: Date) => d.toISOString().slice(0, 10);

function refresh() {
  revalidatePath("/rafiq/tracker");
}

// time: «الجدول اليومي» only (ignored while she has it off); null = «بلا وقت»
type ItemInput = { title: string; value: number; days: number; time?: AgendaTime | null };

const AGENDA_OFF = { error: "الجدول اليومي غير مفعّل — يمكن تفعيله من الإعدادات" };
const agendaOn = async (userId: string) =>
  (await prisma.rafiqUser.findUniqueOrThrow({ where: { id: userId }, select: { agendaEnabled: true } })).agendaEnabled;

/** The submitted time while her agenda is on: undefined = leave as is, null = «بلا وقت». */
async function readTime(userId: string, input: ItemInput): Promise<{ time?: AgendaTime | null } | { error: string }> {
  if (input?.time === undefined || !(await agendaOn(userId))) return {};
  if (input.time === null) return { time: null };
  const time = validateTime(input.time);
  return time ? { time } : { error: "الوقت غير صحيح" };
}

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
  const timed = await readTime(user.id, input);
  if ("error" in timed) return { error: timed.error };
  // new items go last in her order
  const item = await prisma.rafiqTrackerItem.create({ data: { userId: user.id, ...fields, sortOrder: await nextRafiqSortOrder(user.id) }, select: { id: true } });
  if (timed.time) await setRafiqItemTime(user.id, item.id, timed.time);
  refresh();
  return {};
}

/** Editing a mark or its days also re-scores past days (as in courses). */
export async function updateItemAction(id: string, input: ItemInput): Promise<TrackerResult> {
  const user = await getRafiqUser();
  if (!user) return SIGNED_OUT;
  const fields = checkFields(input);
  if ("error" in fields) return { error: fields.error };
  const timed = await readTime(user.id, input);
  if ("error" in timed) return { error: timed.error };
  const { count } = await prisma.rafiqTrackerItem.updateMany({ where: { id: String(id ?? ""), userId: user.id, archivedAt: null }, data: fields });
  if (count === 0) return { error: "هذا البند غير موجود" };
  if (timed.time !== undefined) await setRafiqItemTime(user.id, id, timed.time);
  refresh();
  return {};
}

/** «المحصّلات» of her tracker, on her own days (zone: her browser's time zone). */
export async function summaryAction(kind: unknown, offset: unknown, zone: unknown): Promise<SummaryPayload | { error: string }> {
  const user = await getRafiqUser();
  if (!user) return SIGNED_OUT;
  const { summaryEnabled } = await prisma.rafiqUser.findUniqueOrThrow({ where: { id: user.id }, select: { summaryEnabled: true } });
  if (!summaryEnabled) return { error: "المحصّلات غير مفعّلة — يمكن تفعيلها من الإعدادات" };
  if (!isPeriodKind(kind)) return { error: "فترة غير صحيحة" };
  return rafiqSummary(user.id, kind, clampOffset(offset), zone);
}

/** «الجدول اليومي»: the time of one of her items (null = «بلا وقت»). */
export async function setItemTimeAction(id: string, time: AgendaTime | null): Promise<TrackerResult> {
  const user = await getRafiqUser();
  if (!user) return SIGNED_OUT;
  if (!(await agendaOn(user.id))) return AGENDA_OFF;
  const r = await setRafiqItemTime(user.id, id, time);
  if (!r.error) refresh();
  return r;
}

/** «الجدول اليومي»: her order of her items. */
export async function reorderItemsAction(itemIds: string[]): Promise<TrackerResult> {
  const user = await getRafiqUser();
  if (!user) return SIGNED_OUT;
  if (!(await agendaOn(user.id))) return AGENDA_OFF;
  const r = await setRafiqOrder(user.id, itemIds);
  if (!r.error) refresh();
  return r;
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
