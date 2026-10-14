import "server-only";
import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import { inScope, NO_GROUP_ACCESS, type StaffScope } from "@/lib/staff-scope";
import { itemsForStudentWhere } from "./data";
import { validateOrder, validateTime, type AgendaTime } from "./agenda";

// Writes for «الجدول اليومي» (phase 1: every time applies to every weekday,
// weekdays = 127). The server actions are thin wrappers that check the
// session and the feature switches; every rule about *which* item may be
// changed lives here. Times and order never touch ticks or scores.

const ALL_DAYS = 127;

export type AgendaResult = { error?: string };

const BAD_TIME = { error: "الوقت غير صحيح" };
const NOT_FOUND = { error: "لم يُعثر على هذا البند" };
const BAD_ORDER = { error: "تعذّر حفظ الترتيب — يُرجى تحديث الصفحة والمحاولة مرة أخرى" };

/** A submitted time: a valid time, null («بلا وقت»), or "STAFF" (back to staff's time; course students only). */
export type TimeChoice = AgendaTime | null | "STAFF";

function readChoice(input: unknown, allowStaff: boolean): { choice: TimeChoice } | { error: string } {
  if (input === null) return { choice: null };
  if (input === "STAFF") return allowStaff ? { choice: "STAFF" } : BAD_TIME;
  const t = validateTime(input);
  return t ? { choice: t } : BAD_TIME;
}

// ---------- a course student ----------

type StudentRef = { id: string; courseId: string; groupId: string };

/** Items reaching her that she may place: not archived, not rejected. */
const placeableWhere = (s: StudentRef): Prisma.TrackerItemWhereInput => ({
  AND: [itemsForStudentWhere(s), { archivedAt: null, status: { not: "REJECTED" } }],
});

/**
 * Her own time for an item reaching her: a time, «بلا وقت» (null), or back
 * to staff's time ("STAFF" — for her own items that means «بلا وقت»). She
 * may re-time any item reaching her, staff's included; she never deletes
 * staff's items.
 */
export async function setStudentItemTime(s: StudentRef, itemId: unknown, input: unknown): Promise<AgendaResult> {
  const read = readChoice(input, true);
  if ("error" in read) return read;
  const item = await prisma.trackerItem.findFirst({ where: { id: String(itemId ?? ""), ...placeableWhere(s) }, select: { id: true } });
  if (!item) return NOT_FOUND;
  const key = { itemId_studentId_weekdays: { itemId: item.id, studentId: s.id, weekdays: ALL_DAYS } };
  if (read.choice === "STAFF") {
    await prisma.trackerStudentSlot.deleteMany({ where: { itemId: item.id, studentId: s.id, weekdays: ALL_DAYS } });
  } else {
    const data = { startMin: read.choice?.startMin ?? null, durationMin: read.choice?.durationMin ?? null };
    await prisma.trackerStudentSlot.upsert({ where: key, create: { itemId: item.id, studentId: s.id, weekdays: ALL_DAYS, ...data }, update: data });
  }
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

/** Staff's time for an item (the caller has checked she may edit it). null = «بلا وقت». */
export async function setStaffItemTime(itemId: string, input: unknown): Promise<AgendaResult> {
  const read = readChoice(input, false);
  if ("error" in read) return read;
  if (read.choice === null || read.choice === "STAFF") {
    await prisma.trackerSlot.deleteMany({ where: { itemId, weekdays: ALL_DAYS } });
  } else {
    const data = { startMin: read.choice.startMin, durationMin: read.choice.durationMin };
    await prisma.trackerSlot.upsert({ where: { itemId_weekdays: { itemId, weekdays: ALL_DAYS } }, create: { itemId, weekdays: ALL_DAYS, ...data }, update: data });
  }
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

/** The time of one of her items. null = «بلا وقت». */
export async function setRafiqItemTime(userId: string, itemId: unknown, input: unknown): Promise<AgendaResult> {
  const read = readChoice(input, false);
  if ("error" in read) return read;
  const item = await prisma.rafiqTrackerItem.findFirst({ where: { id: String(itemId ?? ""), userId, archivedAt: null }, select: { id: true } });
  if (!item) return NOT_FOUND;
  if (read.choice === null || read.choice === "STAFF") {
    await prisma.rafiqTrackerSlot.deleteMany({ where: { itemId: item.id, weekdays: ALL_DAYS } });
  } else {
    const data = { startMin: read.choice.startMin, durationMin: read.choice.durationMin };
    await prisma.rafiqTrackerSlot.upsert({
      where: { itemId_weekdays: { itemId: item.id, weekdays: ALL_DAYS } },
      create: { itemId: item.id, userId, weekdays: ALL_DAYS, ...data },
      update: data,
    });
  }
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
