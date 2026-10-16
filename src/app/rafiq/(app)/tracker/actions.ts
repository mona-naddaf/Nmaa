"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { addedBy, resolveSubject } from "@/lib/rafiq/subject";
import { acceptTickDay, addDays, shownOn, validateDays, validateTitle, validateValue } from "@/lib/tracker/rules";
import { RAFIQ_TRACKER_MAX_ITEMS } from "@/lib/rafiq/rules";
import { nextRafiqSortOrder, setRafiqItemSchedule, setRafiqOrder, type ScheduleChoice } from "@/lib/tracker/agenda-data";
import { validateSchedule } from "@/lib/tracker/schedule";
import { rafiqPlace } from "@/lib/prayer/place-data";
import { rafiqSummary, type SummaryPayload } from "@/lib/tracker/summary-data";
import { clampOffset, isPeriodKind } from "@/lib/tracker/summary";

// Her own follow-up tracker: she creates, edits and removes her items (no
// approval), and ticks today or yesterday only. Every action resolves whose
// tracker it is (src/lib/rafiq/subject.ts) and checks the item is theirs.

export type TrackerResult = { error?: string };

const day = (d: Date) => d.toISOString().slice(0, 10);

function refresh() {
  revalidatePath("/rafiq/tracker");
}

// schedule: «الجدول اليومي» only (ignored while she has it off): [{ weekdays, timing }]
// subjectId: «العائلة», a child's id when an adult works on the child's tracker
type ItemInput = { title: string; value: number; days: number; schedule?: ScheduleChoice; subjectId?: string };

const AGENDA_OFF = { error: "الجدول اليومي غير مفعّل — يمكن تفعيله من الإعدادات" };
const agendaOn = async (userId: string) =>
  (await prisma.rafiqUser.findUniqueOrThrow({ where: { id: userId }, select: { agendaEnabled: true } })).agendaEnabled;

/** The submitted schedule while her agenda is on (undefined = leave as is), checked before anything is saved. */
async function readSchedule(userId: string, input: ItemInput): Promise<{ schedule?: unknown; anchors: boolean } | { error: string }> {
  if (!Array.isArray(input?.schedule) || !(await agendaOn(userId))) return { anchors: false };
  const anchors = (await rafiqPlace(userId)) !== null;
  return validateSchedule(input.schedule, anchors) ? { schedule: input.schedule, anchors } : { error: "الوقت غير صحيح" };
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
  const user = await resolveSubject(input?.subjectId, "record");
  if ("error" in user) return user;
  const fields = checkFields(input);
  if ("error" in fields) return { error: fields.error };
  const active = await prisma.rafiqTrackerItem.count({ where: { userId: user.id, archivedAt: null } });
  if (active >= RAFIQ_TRACKER_MAX_ITEMS) return { error: `يمكن أن يضم الجدول ${RAFIQ_TRACKER_MAX_ITEMS} بندًا على الأكثر` };
  const timed = await readSchedule(user.id, input);
  if ("error" in timed) return { error: timed.error };
  // new items go last in her order
  const by = addedBy(user);
  const item = await prisma.rafiqTrackerItem.create({
    data: { userId: user.id, ...fields, sortOrder: await nextRafiqSortOrder(user.id), adultAdded: by.byAdult, createdById: by.adultId },
    select: { id: true },
  });
  if (timed.schedule) await setRafiqItemSchedule(user.id, item.id, timed.schedule, timed.anchors);
  refresh();
  return {};
}

/** Editing a mark or its days also re-scores past days (as in courses). */
export async function updateItemAction(id: string, input: ItemInput): Promise<TrackerResult> {
  const user = await resolveSubject(input?.subjectId, "record");
  if ("error" in user) return user;
  const fields = checkFields(input);
  if ("error" in fields) return { error: fields.error };
  const timed = await readSchedule(user.id, input);
  if ("error" in timed) return { error: timed.error };
  const { count } = await prisma.rafiqTrackerItem.updateMany({ where: { id: String(id ?? ""), userId: user.id, archivedAt: null }, data: fields });
  if (count === 0) return { error: "هذا البند غير موجود" };
  if (timed.schedule) await setRafiqItemSchedule(user.id, id, timed.schedule, timed.anchors);
  refresh();
  return {};
}

/** «المحصّلات» of her tracker, on her own days (zone: her browser's time zone). */
export async function summaryAction(kind: unknown, offset: unknown, zone: unknown, subjectId?: string): Promise<SummaryPayload | { error: string }> {
  const user = await resolveSubject(subjectId, "view");
  if ("error" in user) return user;
  const { summaryEnabled } = await prisma.rafiqUser.findUniqueOrThrow({ where: { id: user.id }, select: { summaryEnabled: true } });
  if (!summaryEnabled) return { error: "المحصّلات غير مفعّلة — يمكن تفعيلها من الإعدادات" };
  if (!isPeriodKind(kind)) return { error: "فترة غير صحيحة" };
  return rafiqSummary(user.id, kind, clampOffset(offset), zone);
}

/** «الجدول اليومي»: the schedule of one of her items. */
export async function setItemScheduleAction(id: string, schedule: ScheduleChoice, subjectId?: string): Promise<TrackerResult> {
  const user = await resolveSubject(subjectId, "record");
  if ("error" in user) return user;
  if (!(await agendaOn(user.id))) return AGENDA_OFF;
  const r = await setRafiqItemSchedule(user.id, id, schedule === "STAFF" ? [] : schedule, (await rafiqPlace(user.id)) !== null);
  if (!r.error) refresh();
  return r;
}

/** «الجدول اليومي»: her order of her items. */
export async function reorderItemsAction(itemIds: string[], subjectId?: string): Promise<TrackerResult> {
  const user = await resolveSubject(subjectId, "record");
  if ("error" in user) return user;
  if (!(await agendaOn(user.id))) return AGENDA_OFF;
  const r = await setRafiqOrder(user.id, itemIds);
  if (!r.error) refresh();
  return r;
}

/** Removes it from today on; earlier days keep it and their ticks. */
export async function removeItemAction(id: string, subjectId?: string): Promise<TrackerResult> {
  const user = await resolveSubject(subjectId, "record");
  if ("error" in user) return user;
  const { count } = await prisma.rafiqTrackerItem.updateMany({
    where: { id: String(id ?? ""), userId: user.id, archivedAt: null },
    data: { archivedAt: new Date() },
  });
  if (count === 0) return { error: "هذا البند غير موجود" };
  refresh();
  return {};
}

/** Tick (on) or untick an item for her today or yesterday. today = her browser's local date. */
export async function setCheckAction(input: { itemId: string; day: string; today: string; on: boolean; subjectId?: string }): Promise<TrackerResult> {
  const user = await resolveSubject(input?.subjectId, "record");
  if ("error" in user) return user;
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
