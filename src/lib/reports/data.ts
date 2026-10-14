import "server-only";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth/require";
import { parseDateOnlyInput } from "@/lib/attendance";
import { courseTimeZone } from "@/lib/time/course-zone";
import { isoOf, zoneDateOnly, zoneDayOf, zoneDayRange } from "@/lib/time/zone";
import type { Session } from "@/lib/auth/session";
import { NEUTRAL_GROUP_GENDER, type GroupGender } from "@/lib/text/gender";

// Active students, plus archived ones whose supervisor kept them in reports.
const IN_REPORTS = { OR: [{ archivedAt: null }, { keepInReports: true }] };
const ARCHIVED_MARK = " (في الأرشيف)";

export interface ReportRow {
  studentId: string;
  name: string;
  groupName: string;
  totalPages: number;
  attendanceDays: number;
  totalPoints: number;
}

export interface ResolvedReportScope {
  scope: "course" | "group" | "student";
  groupIds?: string[]; // filter applied to the query; undefined = no group restriction
  studentId?: string;
  // the course's days (its time zone, lib/time/zone.ts), as date-only values
  from: Date;
  to: Date;
  // "YYYY-MM-DD": today and the day the course was created, for «الكل»
  today: string;
  courseStart: string;
  // for rendering the filter UI with the right options
  visibleGroups: { id: string; name: string }[];
  visibleStudents: { id: string; name: string; groupId: string; archived: boolean }[];
  courseName: string;
  // the single group's gender when the scope narrows to one group/student,
  // otherwise the neutral default (course-wide/mixed scope)
  scopeGender: GroupGender;
}

/**
 * Reads scope + date-range from URL search params, validates them against
 * the current session's course and (for a group-restricted teacher) her
 * assigned groups, and returns everything the reports page needs to render
 * the filter UI and run the query. Redirects to /students if the session
 * can't see the requested scope at all.
 */
export async function resolveReportScope(
  searchParams: Record<string, string | string[] | undefined>,
): Promise<{ session: Session; resolved: ResolvedReportScope }> {
  const session = await requireSession();

  const course = await prisma.course.findUniqueOrThrow({
    where: { id: session.courseId },
    include: { groups: { orderBy: { sortOrder: "asc" } } },
  });

  let allowedGroupIds: string[] | null = null; // null = no restriction
  if (session.role === "teacher" && course.visibilityMode === "ASSIGNED") {
    const assignments = await prisma.teacherGroupAssignment.findMany({ where: { teacherId: session.teacherId } });
    if (assignments.length > 0) {
      allowedGroupIds = assignments.map((a) => a.groupId);
    }
  }

  const visibleGroups = allowedGroupIds
    ? course.groups.filter((g) => allowedGroupIds!.includes(g.id))
    : course.groups;

  const visibleStudents = (
    await prisma.student.findMany({
      where: { courseId: course.id, ...IN_REPORTS, ...(allowedGroupIds ? { groupId: { in: allowedGroupIds } } : {}) },
      select: { id: true, name: true, groupId: true, archivedAt: true },
      orderBy: { name: "asc" },
    })
  ).map(({ archivedAt, ...s }) => ({ ...s, archived: archivedAt !== null }));

  const single = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const scopeParam = single(searchParams.scope) ?? "course";
  const groupIdParam = single(searchParams.groupId);
  const studentIdParam = single(searchParams.studentId);

  let scope: ResolvedReportScope["scope"] = "course";
  let groupIds: string[] | undefined = allowedGroupIds ?? undefined;
  let studentId: string | undefined;

  // an invalid/tampered id (someone else's student, a stale group) just
  // falls back to the safe default (whole visible course) rather than erroring
  if (scopeParam === "student" && studentIdParam && visibleStudents.some((s) => s.id === studentIdParam)) {
    scope = "student";
    studentId = studentIdParam;
    groupIds = undefined;
  } else if (scopeParam === "group" && groupIdParam && visibleGroups.some((g) => g.id === groupIdParam)) {
    scope = "group";
    groupIds = [groupIdParam];
  }

  const fromParam = single(searchParams.from);
  const toParam = single(searchParams.to);
  const timeZone = await courseTimeZone(course.id);
  const today = zoneDateOnly(timeZone);
  const courseStart = zoneDayOf(timeZone, course.createdAt);
  const to = (fromParam && toParam && parseDateOnlyInput(toParam, timeZone)) || today;
  const from = (fromParam && parseDateOnlyInput(fromParam, timeZone)) || new Date(`${courseStart}T00:00:00Z`);

  const genderByGroupId = new Map(course.groups.map((g) => [g.id, g.gender]));
  const scopeGender: GroupGender =
    scope === "student"
      ? (genderByGroupId.get(visibleStudents.find((s) => s.id === studentId)?.groupId ?? "") ?? NEUTRAL_GROUP_GENDER)
      : scope === "group" && groupIds?.[0]
        ? (genderByGroupId.get(groupIds[0]) ?? NEUTRAL_GROUP_GENDER)
        : NEUTRAL_GROUP_GENDER;

  return {
    session,
    resolved: {
      scope,
      groupIds,
      studentId,
      from,
      to,
      today: isoOf(today),
      courseStart,
      visibleGroups: visibleGroups.map((g) => ({ id: g.id, name: g.name })),
      visibleStudents,
      courseName: course.name,
      scopeGender,
    },
  };
}

export async function getReportRows(courseId: string, resolved: ResolvedReportScope): Promise<ReportRow[]> {
  const students = await prisma.student.findMany({
    where: {
      courseId,
      ...IN_REPORTS,
      ...(resolved.studentId ? { id: resolved.studentId } : {}),
      ...(resolved.groupIds ? { groupId: { in: resolved.groupIds } } : {}),
    },
    include: { group: { select: { name: true } } },
    orderBy: { name: "asc" },
  });
  if (students.length === 0) return [];
  const studentIds = students.map((s) => s.id);

  // sessions within the range's days in the course's time zone
  const range = zoneDayRange(await courseTimeZone(courseId), isoOf(resolved.from), isoOf(resolved.to));

  const [sessions, pointsLogs, attendanceLogs] = await Promise.all([
    prisma.recitationSession.findMany({
      // prior-to-joining memorization didn't happen within any real date
      // range, so it's excluded here exactly like on the leaderboard
      where: { studentId: { in: studentIds }, source: "LOGGED", occurredAt: range },
      select: { studentId: true, pagesCalculated: true },
    }),
    prisma.pointsLog.findMany({
      where: { studentId: { in: studentIds }, day: { gte: resolved.from, lte: resolved.to } },
      select: { studentId: true, valueAtTime: true, typeAtTime: true },
    }),
    prisma.attendanceLog.findMany({
      where: { studentId: { in: studentIds }, status: "IN", day: { gte: resolved.from, lte: resolved.to } },
      select: { studentId: true },
    }),
  ]);

  const pagesByStudent = new Map<string, number>();
  for (const s of sessions) {
    pagesByStudent.set(s.studentId, (pagesByStudent.get(s.studentId) ?? 0) + Number(s.pagesCalculated));
  }
  const pointsByStudent = new Map<string, number>();
  for (const p of pointsLogs) {
    const delta = p.typeAtTime === "ADD" ? p.valueAtTime : -p.valueAtTime;
    pointsByStudent.set(p.studentId, (pointsByStudent.get(p.studentId) ?? 0) + delta);
  }
  const attendanceByStudent = new Map<string, number>();
  for (const a of attendanceLogs) {
    attendanceByStudent.set(a.studentId, (attendanceByStudent.get(a.studentId) ?? 0) + 1);
  }

  return (
    students
      // an archived student only appears for ranges where she has data
      .filter((s) => !s.archivedAt || pagesByStudent.has(s.id) || attendanceByStudent.has(s.id) || pointsByStudent.has(s.id))
      .map((s) => ({
        studentId: s.id,
        name: s.archivedAt ? s.name + ARCHIVED_MARK : s.name,
        groupName: s.group.name,
        totalPages: Math.round((pagesByStudent.get(s.id) ?? 0) * 1000) / 1000,
        attendanceDays: attendanceByStudent.get(s.id) ?? 0,
        totalPoints: pointsByStudent.get(s.id) ?? 0,
      }))
  );
}
