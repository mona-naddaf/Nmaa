import "server-only";
import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import { inScope, ownsRecord, type StaffScope } from "@/lib/staff-scope";
import type { GroupGender } from "@/lib/text/gender";
import { addDays, TRACKER_LIMITS, type ScoredItem } from "./rules";
import { byAgendaOrder, placeOf } from "./agenda";
import type { SlotRow } from "./schedule";
import type { ExcuseMode } from "@/lib/excuse/rules";
import { courseTimeZone } from "@/lib/time/course-zone";
import { zoneDayOf, zoneToday } from "@/lib/time/zone";

// The only place tracker data is read for display (student, staff and
// parent views all use this). Scores are never computed or stored here:
// each view gets items + ticks for a short window of days and works the
// scores out with the pure rules (dayScore), on the course's days (its time
// zone, lib/time/zone.ts).

export interface TrackerItemView extends ScoredItem {
  title: string;
  // she created it herself (shown with «بانتظار الاعتماد» / «لم يُعتمد»)
  own: boolean;
  reviewedDay: string | null;
  // ISO timestamps: the browser re-derives createdDay/archivedDay from them
  // (withLocalDays), in the course's time zone like the days above
  createdAt: string;
  archivedAt: string | null;
  // «الجدول اليومي» (lib/tracker/agenda.ts) — order and times never touch scores.
  // staff's order of the items (Rafiq: her own); ties: creation order
  sortOrder: number;
  // her personal place in the order, if she set one
  position?: number | null;
  // its timing rows (schedule.ts): staff's (course) or hers («رفيق الحفظ»)
  slots?: SlotRow[];
  // a course student's own rows for it, which come first on their days
  ownSlots?: SlotRow[];
  // «أيام العذر» (src/lib/excuse): its setting, only for a viewer who may see the excuse
  excuseMode?: ExcuseMode;
  excuseAltTitle?: string | null;
}

export interface TrackerSheet {
  items: TrackerItemView[];
  // day → ids of items ticked that day
  checks: Record<string, string[]>;
}

const day = (d: Date) => d.toISOString().slice(0, 10);
/** Window start: far enough back for this week + last week (plus a day of slack). */
const windowStart = (days: number, tz: string) => addDays(zoneToday(tz), -days);

/** Prisma `where` for every item that reaches this student (archived included — they still count before their archive day). */
export const itemsForStudentWhere = (s: { id: string; courseId: string; groupId: string }): Prisma.TrackerItemWhereInput => ({
  courseId: s.courseId,
  OR: [{ targetGroupId: s.groupId }, { students: { some: { studentId: s.id } } }, { createdByStudentId: s.id }],
});

const itemSelect = {
  id: true,
  title: true,
  value: true,
  status: true,
  days: true,
  createdAt: true,
  archivedAt: true,
  reviewedAt: true,
  createdByStudentId: true,
  sortOrder: true,
} as const;

type ItemRow = Prisma.TrackerItemGetPayload<{ select: typeof itemSelect }>;

const toView = (r: ItemRow, studentId: string | null, tz: string): TrackerItemView => ({
  id: r.id,
  title: r.title,
  value: r.value,
  status: r.status,
  days: r.days,
  createdDay: zoneDayOf(tz, r.createdAt),
  archivedDay: r.archivedAt ? zoneDayOf(tz, r.archivedAt) : null,
  reviewedDay: r.reviewedAt ? zoneDayOf(tz, r.reviewedAt) : null,
  createdAt: r.createdAt.toISOString(),
  archivedAt: r.archivedAt ? r.archivedAt.toISOString() : null,
  own: studentId !== null && r.createdByStudentId === studentId,
  sortOrder: r.sortOrder,
});

const ROW = { weekdays: true, startMin: true, durationMin: true, anchor: true, anchorOffsetMin: true } as const;

/** Rows grouped by item, every-day row first. */
function byItem(rows: (SlotRow & { itemId: string })[]): Map<string, SlotRow[]> {
  const out = new Map<string, SlotRow[]>();
  for (const { itemId, ...r } of rows) out.set(itemId, [...(out.get(itemId) ?? []), r]);
  for (const list of out.values()) list.sort((a, b) => (b.weekdays === 127 ? 1 : 0) - (a.weekdays === 127 ? 1 : 0) || a.weekdays - b.weekdays);
  return out;
}

/** Each item's timing rows (staff's and hers) and her order, in her order. */
async function withAgenda(items: TrackerItemView[], studentId: string): Promise<TrackerItemView[]> {
  if (items.length === 0) return items;
  const ids = items.map((i) => i.id);
  const [staffSlots, ownSlots, order] = await Promise.all([
    prisma.trackerSlot.findMany({ where: { itemId: { in: ids } }, select: { itemId: true, ...ROW } }),
    prisma.trackerStudentSlot.findMany({ where: { studentId, itemId: { in: ids } }, select: { itemId: true, ...ROW } }),
    prisma.trackerStudentOrder.findMany({ where: { studentId, itemId: { in: ids } }, select: { itemId: true, position: true } }),
  ]);
  const staff = byItem(staffSlots);
  const own = byItem(ownSlots);
  const pos = new Map(order.map((o) => [o.itemId, o.position]));
  return byAgendaOrder(items.map((i) => ({ ...i, position: pos.get(i.id) ?? null, slots: staff.get(i.id) ?? [], ownSlots: own.get(i.id) ?? [] })));
}

/** Items that matter inside the window: not archived before it; rejected only while still shown (D8). */
function windowWhere(fromDay: string): Prisma.TrackerItemWhereInput {
  const from = new Date(`${fromDay}T00:00:00Z`);
  const rejectedSince = new Date(Date.now() - (TRACKER_LIMITS.rejectedShowDays + 1) * 24 * 60 * 60 * 1000);
  return {
    AND: [
      { OR: [{ archivedAt: null }, { archivedAt: { gte: from } }] },
      { OR: [{ status: { not: "REJECTED" } }, { reviewedAt: { gte: rejectedSince } }] },
    ],
  };
}

/** One student's sheet for the last `days` days (plus a day of time-zone slack). */
export async function getStudentTracker(studentId: string, days = 16): Promise<TrackerSheet> {
  const s = await prisma.student.findUniqueOrThrow({ where: { id: studentId }, select: { id: true, courseId: true, groupId: true } });
  const tz = await courseTimeZone(s.courseId);
  const fromDay = windowStart(days, tz);
  const [rows, checks] = await Promise.all([
    prisma.trackerItem.findMany({
      where: { AND: [itemsForStudentWhere(s), windowWhere(fromDay)] },
      orderBy: { createdAt: "asc" },
      select: itemSelect,
    }),
    prisma.trackerCheck.findMany({
      where: { studentId, day: { gte: new Date(`${fromDay}T00:00:00Z`) } },
      select: { itemId: true, day: true },
    }),
  ]);
  const byDay: Record<string, string[]> = {};
  for (const c of checks) (byDay[day(c.day)] ??= []).push(c.itemId);
  return { items: await withAgenda(rows.map((r) => toView(r, studentId, tz)), studentId), checks: byDay };
}

// ---------- Staff ----------

export interface GroupTracker {
  students: { id: string; name: string }[];
  items: TrackerItemView[];
  // which items reach each student
  itemIds: Record<string, string[]>;
  // student → day → ticked item ids
  checks: Record<string, Record<string, string[]>>;
}

/** The overview table's data: every active student of the group, two weeks back. */
export async function getGroupTracker(groupId: string, days = 16): Promise<GroupTracker> {
  const students = await prisma.student.findMany({
    where: { groupId, archivedAt: null },
    orderBy: { name: "asc" },
    select: { id: true, name: true, courseId: true },
  });
  if (students.length === 0) return { students: [], items: [], itemIds: {}, checks: {} };
  const ids = students.map((s) => s.id);
  const tz = await courseTimeZone(students[0].courseId);
  const fromDay = windowStart(days, tz);
  const [rows, checks] = await Promise.all([
    prisma.trackerItem.findMany({
      where: {
        AND: [
          { courseId: students[0].courseId },
          { OR: [{ targetGroupId: groupId }, { students: { some: { studentId: { in: ids } } } }, { createdByStudentId: { in: ids } }] },
          windowWhere(fromDay),
        ],
      },
      orderBy: { createdAt: "asc" },
      select: { ...itemSelect, targetGroupId: true, students: { select: { studentId: true } } },
    }),
    prisma.trackerCheck.findMany({
      where: { studentId: { in: ids }, day: { gte: new Date(`${fromDay}T00:00:00Z`) } },
      select: { itemId: true, studentId: true, day: true },
    }),
  ]);

  const itemIds: Record<string, string[]> = Object.fromEntries(ids.map((id) => [id, []]));
  for (const r of rows) {
    const reach = r.targetGroupId === groupId ? ids : r.createdByStudentId ? [r.createdByStudentId] : r.students.map((x) => x.studentId);
    for (const sid of reach) itemIds[sid]?.push(r.id);
  }
  const byStudent: GroupTracker["checks"] = {};
  for (const c of checks) ((byStudent[c.studentId] ??= {})[day(c.day)] ??= []).push(c.itemId);

  return {
    students: students.map(({ id, name }) => ({ id, name })),
    items: rows.map((r) => toView(r, null, tz)),
    itemIds,
    checks: byStudent,
  };
}

export interface StaffTrackerItem {
  id: string;
  title: string;
  value: number | null;
  days: number;
  status: "APPROVED" | "PENDING" | "REJECTED";
  target:
    | { kind: "GROUP"; groupId: string; groupName: string }
    | { kind: "STUDENTS"; students: { id: string; name: string }[] }
    | { kind: "OWN"; student: { id: string; name: string; groupName: string } };
  creatorName: string | null; // staff creator; null = the supervisor (or a student, see target.kind)
  canEdit: boolean;
  archived: boolean;
  createdDay: string;
  // «الجدول اليومي»: staff's timing rows (schedule.ts) and its place in staff's order
  slots: SlotRow[];
  sortOrder: number;
}

const staffSelect = {
  id: true,
  title: true,
  value: true,
  days: true,
  status: true,
  createdAt: true,
  archivedAt: true,
  createdByTeacherId: true,
  createdByTeacher: { select: { name: true } },
  targetGroup: { select: { id: true, name: true } },
  createdByStudent: { select: { id: true, name: true, groupId: true, group: { select: { name: true } } } },
  students: {
    where: { student: { archivedAt: null } },
    select: { student: { select: { id: true, name: true, groupId: true } } },
  },
  sortOrder: true,
  slots: { select: { weekdays: true, startMin: true, durationMin: true, anchor: true, anchorOffsetMin: true }, orderBy: { weekdays: "desc" } },
} as const;

type StaffRow = Prisma.TrackerItemGetPayload<{ select: typeof staffSelect }>;

function toStaff(scope: StaffScope, r: StaffRow, tz: string): StaffTrackerItem {
  let target: StaffTrackerItem["target"];
  let canEdit: boolean;
  if (r.createdByStudent) {
    const st = r.createdByStudent;
    target = { kind: "OWN", student: { id: st.id, name: st.name, groupName: st.group.name } };
    // D9: a student's item, once hers to edit only while pending, is any
    // staff member's (within her group) to manage
    canEdit = inScope(scope, st.groupId);
  } else {
    target = r.targetGroup
      ? { kind: "GROUP", groupId: r.targetGroup.id, groupName: r.targetGroup.name }
      : { kind: "STUDENTS", students: r.students.map((x) => x.student).filter((s) => inScope(scope, s.groupId)).map(({ id, name }) => ({ id, name })) };
    canEdit = ownsRecord(scope, r.createdByTeacherId);
  }
  return {
    id: r.id,
    title: r.title,
    value: r.value,
    days: r.days,
    status: r.status,
    target,
    creatorName: r.createdByTeacherId ? (r.createdByTeacher?.name ?? null) : null,
    canEdit,
    archived: r.archivedAt !== null,
    createdDay: zoneDayOf(tz, r.createdAt),
    slots: r.slots,
    sortOrder: r.sortOrder,
  };
}

/** Approved items reaching this group (whole group, picked students in it, its students' own). Archived last. */
export async function getStaffTrackerItems(scope: StaffScope, groupId: string): Promise<StaffTrackerItem[]> {
  if (!inScope(scope, groupId)) return [];
  const rows = await prisma.trackerItem.findMany({
    where: {
      courseId: scope.courseId,
      status: "APPROVED",
      OR: [
        { targetGroupId: groupId },
        { students: { some: { student: { groupId, archivedAt: null } } } },
        { createdByStudent: { groupId, archivedAt: null } },
      ],
    },
    orderBy: [{ archivedAt: { sort: "asc", nulls: "first" } }, { createdAt: "asc" }, { id: "asc" }],
    take: 200,
    select: staffSelect,
  });
  const tz = await courseTimeZone(scope.courseId);
  // the group's order («الجدول اليومي»; unplaced items last), archived ones at the end
  const items = rows.map((r) => toStaff(scope, r, tz));
  return [...items].sort((a, b) => Number(a.archived) - Number(b.archived) || placeOf(a.sortOrder) - placeOf(b.sortOrder));
}

export interface PendingItem {
  id: string;
  title: string;
  days: number;
  student: { id: string; name: string; groupId: string; groupName: string; gender: GroupGender };
  createdAt: string; // ISO — shown as the course's day (withLocalDays / localDayOf)
}

/** Students' own items awaiting approval, in her groups, oldest first. */
export async function getApprovalQueue(scope: StaffScope, groupId?: string | null): Promise<PendingItem[]> {
  const groupIn = groupId ? [groupId] : scope.groupLimit;
  const rows = await prisma.trackerItem.findMany({
    where: {
      courseId: scope.courseId,
      status: "PENDING",
      archivedAt: null,
      createdByStudent: { archivedAt: null, ...(groupIn ? { groupId: { in: groupIn } } : {}) },
    },
    orderBy: { createdAt: "asc" },
    take: 200,
    select: {
      id: true,
      title: true,
      days: true,
      createdAt: true,
      createdByStudent: { select: { id: true, name: true, groupId: true, group: { select: { name: true, gender: true } } } },
    },
  });
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    days: r.days,
    createdAt: r.createdAt.toISOString(),
    student: {
      id: r.createdByStudent!.id,
      name: r.createdByStudent!.name,
      groupId: r.createdByStudent!.groupId,
      groupName: r.createdByStudent!.group.name,
      gender: r.createdByStudent!.group.gender,
    },
  }));
}
