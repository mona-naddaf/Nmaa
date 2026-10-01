import "server-only";
import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import { inScope, ownsRecord, type StaffScope } from "@/lib/staff-scope";
import type { GroupGender } from "@/lib/text/gender";
import { addDays, TRACKER_LIMITS, type ScoredItem } from "./rules";

// The only place tracker data is read for display (student, staff and
// parent views all use this). Scores are never computed or stored here:
// each view gets items + ticks for a short window of days and works the
// scores out with the pure rules (dayScore), using the viewer's own local
// "today" — the server (UTC) can't know it.

export interface TrackerItemView extends ScoredItem {
  title: string;
  // she created it herself (shown with «بانتظار الاعتماد» / «لم يُعتمد»)
  own: boolean;
  reviewedDay: string | null;
  // ISO timestamps: the browser re-derives createdDay/archivedDay in its own
  // time zone (withLocalDays); the UTC days above are the server's view
  createdAt: string;
  archivedAt: string | null;
}

export interface TrackerSheet {
  items: TrackerItemView[];
  // day → ids of items ticked that day
  checks: Record<string, string[]>;
}

const day = (d: Date) => d.toISOString().slice(0, 10);
const utcToday = () => day(new Date());

/** Window start: far enough back for this week + last week in any time zone. */
const windowStart = (days: number) => addDays(utcToday(), -days);

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
} as const;

type ItemRow = Prisma.TrackerItemGetPayload<{ select: typeof itemSelect }>;

const toView = (r: ItemRow, studentId: string | null): TrackerItemView => ({
  id: r.id,
  title: r.title,
  value: r.value,
  status: r.status,
  days: r.days,
  createdDay: day(r.createdAt),
  archivedDay: r.archivedAt ? day(r.archivedAt) : null,
  reviewedDay: r.reviewedAt ? day(r.reviewedAt) : null,
  createdAt: r.createdAt.toISOString(),
  archivedAt: r.archivedAt ? r.archivedAt.toISOString() : null,
  own: studentId !== null && r.createdByStudentId === studentId,
});

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
  const fromDay = windowStart(days);
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
  return { items: rows.map((r) => toView(r, studentId)), checks: byDay };
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
  const fromDay = windowStart(days);
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
    items: rows.map((r) => toView(r, null)),
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
} as const;

type StaffRow = Prisma.TrackerItemGetPayload<{ select: typeof staffSelect }>;

function toStaff(scope: StaffScope, r: StaffRow): StaffTrackerItem {
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
    createdDay: day(r.createdAt),
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
    orderBy: [{ archivedAt: { sort: "asc", nulls: "first" } }, { createdAt: "asc" }],
    take: 200,
    select: staffSelect,
  });
  return rows.map((r) => toStaff(scope, r));
}

export interface PendingItem {
  id: string;
  title: string;
  days: number;
  student: { id: string; name: string; groupId: string; groupName: string; gender: GroupGender };
  createdAt: string; // ISO — shown as the viewer's local day
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
