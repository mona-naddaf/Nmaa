import "server-only";
import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import { inScope, NO_GROUP_ACCESS, type StaffScope } from "@/lib/staff-scope";
import { itemsForStudentWhere } from "./data";
import { validateOrder } from "./agenda";
import { ALL_DAYS, validateSchedule, type SlotRow } from "./schedule";

// Writes for «الجدول اليومي»: an item's schedule (schedule.ts — clock times
// or prayer anchors, every day or per weekday) and the order. The server
// actions are thin wrappers that check the session and the feature
// switches; every rule about *which* item may be changed lives here. Times
// and order never touch ticks or scores.

export type AgendaResult = { error?: string };

const BAD_TIME = { error: "الوقت غير صحيح" };
const NO_PLACE = { error: "يُرجى تحديد المدينة أولًا لاستخدام أوقات الصلاة" };
const NOT_FOUND = { error: "لم يُعثر على هذا البند" };
const BAD_ORDER = { error: "تعذّر حفظ الترتيب — يُرجى تحديث الصفحة والمحاولة مرة أخرى" };

/** A submitted schedule: [{ weekdays, timing }] (schedule.ts), or "STAFF" (back to staff's; course students only). */
export type ScheduleChoice = { weekdays: number; timing: unknown }[] | "STAFF";

/** The rows to store, or what's wrong (an anchor without a place is refused). */
function readSchedule(input: unknown, allowAnchors: boolean): SlotRow[] | { error: string } {
  const rows = validateSchedule(input, allowAnchors);
  if (rows) return rows;
  return !allowAnchors && validateSchedule(input, true) ? NO_PLACE : BAD_TIME;
}

/** An every-day row with no time is the same as no row (staff's and Rafiq items). */
const withoutEmptyBase = (rows: SlotRow[]) => rows.filter((r) => !(r.weekdays === ALL_DAYS && r.startMin === null && r.anchor === null));

const rowData = (r: SlotRow) => ({ weekdays: r.weekdays, startMin: r.startMin, durationMin: r.durationMin, anchor: r.anchor, anchorOffsetMin: r.anchorOffsetMin });

// ---------- a course student ----------

type StudentRef = { id: string; courseId: string; groupId: string };

/** Items reaching her that she may place: not archived, not rejected. */
const placeableWhere = (s: StudentRef): Prisma.TrackerItemWhereInput => ({
  AND: [itemsForStudentWhere(s), { archivedAt: null, status: { not: "REJECTED" } }],
});

/**
 * Her own schedule for an item reaching her (it replaces staff's on the days
 * it covers; her every-day row with no time = «بلا وقت»), or back to staff's
 * ("STAFF" — for her own items that means «بلا وقت»). She may re-time any
 * item reaching her, staff's included; she never deletes staff's items.
 * allowAnchors: the course has a place.
 */
export async function setStudentItemSchedule(s: StudentRef, itemId: unknown, input: unknown, allowAnchors: boolean): Promise<AgendaResult> {
  const item = await prisma.trackerItem.findFirst({ where: { id: String(itemId ?? ""), ...placeableWhere(s) }, select: { id: true } });
  if (!item) return NOT_FOUND;
  const rows = input === "STAFF" ? [] : readSchedule(input, allowAnchors);
  if ("error" in rows) return rows;
  await prisma.$transaction([
    prisma.trackerStudentSlot.deleteMany({ where: { itemId: item.id, studentId: s.id } }),
    prisma.trackerStudentSlot.createMany({ data: rows.map((r) => ({ itemId: item.id, studentId: s.id, ...rowData(r) })) }),
  ]);
  return {};
}

/** Her personal order: every id must be an item she may place; the rest keep staff's order after them. */
export async function setStudentOrder(s: StudentRef, input: unknown): Promise<AgendaResult> {
  const allowed = new Set((await prisma.trackerItem.findMany({ where: placeableWhere(s), select: { id: true } })).map((i) => i.id));
  const ids = validateOrder(input, allowed);
  if (!ids) return BAD_ORDER;
  await prisma.$transaction([
    prisma.trackerStudentOrder.deleteMany({ where: { studentId: s.id } }),
    prisma.trackerStudentOrder.createMany({ data: ids.map((itemId, position) => ({ studentId: s.id, itemId, position })) }),
  ]);
  return {};
}

// ---------- staff ----------

/** Staff's schedule for an item (the caller has checked she may edit it). allowAnchors: the course has a place. */
export async function setStaffItemSchedule(itemId: string, input: unknown, allowAnchors: boolean): Promise<AgendaResult> {
  const rows = readSchedule(input, allowAnchors);
  if ("error" in rows) return rows;
  await prisma.$transaction([
    prisma.trackerSlot.deleteMany({ where: { itemId } }),
    prisma.trackerSlot.createMany({ data: withoutEmptyBase(rows).map((r) => ({ itemId, ...rowData(r) })) }),
  ]);
  return {};
}

/** The approved, active items staff see for a group (as getStaffTrackerItems). */
const groupItemsWhere = (scope: StaffScope, groupId: string): Prisma.TrackerItemWhereInput => ({
  courseId: scope.courseId,
  status: "APPROVED",
  archivedAt: null,
  OR: [
    { targetGroupId: groupId },
    { students: { some: { student: { groupId, archivedAt: null } } } },
    { createdByStudent: { groupId, archivedAt: null } },
  ],
});

/** Staff's order of a group's items (the group's template order). Any staff member over the group. */
export async function setStaffOrder(scope: StaffScope, groupId: unknown, input: unknown): Promise<AgendaResult> {
  const gid = String(groupId ?? "");
  if (!inScope(scope, gid)) return { error: NO_GROUP_ACCESS };
  const allowed = new Set((await prisma.trackerItem.findMany({ where: groupItemsWhere(scope, gid), select: { id: true } })).map((i) => i.id));
  const ids = validateOrder(input, allowed);
  if (!ids) return BAD_ORDER;
  // places start at 1 (0 = not placed yet, see byAgendaOrder)
  await prisma.$transaction(ids.map((id, i) => prisma.trackerItem.update({ where: { id }, data: { sortOrder: i + 1 } })));
  return {};
}

// ---------- «رفيق الحفظ» ----------

/** The schedule of one of her items. allowAnchors: she has set her place. */
export async function setRafiqItemSchedule(userId: string, itemId: unknown, input: unknown, allowAnchors: boolean): Promise<AgendaResult> {
  const item = await prisma.rafiqTrackerItem.findFirst({ where: { id: String(itemId ?? ""), userId, archivedAt: null }, select: { id: true } });
  if (!item) return NOT_FOUND;
  const rows = readSchedule(input, allowAnchors);
  if ("error" in rows) return rows;
  await prisma.$transaction([
    prisma.rafiqTrackerSlot.deleteMany({ where: { itemId: item.id } }),
    prisma.rafiqTrackerSlot.createMany({ data: withoutEmptyBase(rows).map((r) => ({ itemId: item.id, userId, ...rowData(r) })) }),
  ]);
  return {};
}

/** Her order of her active items. */
export async function setRafiqOrder(userId: string, input: unknown): Promise<AgendaResult> {
  const allowed = new Set((await prisma.rafiqTrackerItem.findMany({ where: { userId, archivedAt: null }, select: { id: true } })).map((i) => i.id));
  const ids = validateOrder(input, allowed);
  if (!ids) return BAD_ORDER;
  await prisma.$transaction(ids.map((id, i) => prisma.rafiqTrackerItem.update({ where: { id }, data: { sortOrder: i + 1 } })));
  return {};
}

/** Where a new item of hers goes: after the rest (0 while she has never reordered: creation order). */
export async function nextRafiqSortOrder(userId: string): Promise<number> {
  const last = await prisma.rafiqTrackerItem.aggregate({ where: { userId, archivedAt: null }, _max: { sortOrder: true } });
  const max = last._max.sortOrder ?? 0;
  return max > 0 ? max + 1 : 0;
}
