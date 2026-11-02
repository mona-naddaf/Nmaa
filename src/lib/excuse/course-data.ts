import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import type { Session } from "@/lib/auth/session";
import { courseTimeZone } from "@/lib/time/course-zone";
import { dateOnly, isoOf } from "@/lib/time/zone";
import { addDays, isActiveOn, weekdayOf } from "@/lib/tracker/rules";
import { effectiveTiming, resolveTiming } from "@/lib/tracker/schedule";
import { itemsForStudentWhere } from "@/lib/tracker/data";
import { prayerMinutes } from "@/lib/prayer/times";
import { coursePlace } from "@/lib/prayer/place-data";
import { excuseAllowed, excuseEnabled } from "./enabled";
import { excusedDays } from "./attendance";
import { excuseLens } from "./lens";
import { nowIn, readMoment, toExcuse, type ExcuseResult, type MomentInput } from "./rafiq-data";
import { boundaryKeys, checkEnd, checkStart, effectiveEnd, isActive, keyOf, type Excuse, type Moment, type MomentError } from "./rules";
import type { TrackerExcuse } from "./subject";
import { lastExcuseLine, momentErrorText, type Actor } from "./texts";
import { courseActs, courseSees, type CourseStudent, type CourseViewer } from "./visibility";

// «أيام العذر» in a course: who gets what, and starting and ending a
// student's excuse. Who sees is decided on the server, before anything about
// an excuse is loaded (src/lib/excuse/visibility.ts). Her days are the
// course's (its time zone), as attendance's are.

/**
 * The feature reaches this course at all: EXCUSE_ENABLED, and its
 * supervisor's email in EXCUSE_ALLOW_EMAILS («*» = every course). Without
 * it the switch isn't offered and Course.excuseEnabled is ignored.
 */
export async function courseExcuseAllowed(courseId: string): Promise<boolean> {
  if (!excuseEnabled()) return false;
  const c = await prisma.course.findUnique({ where: { id: courseId }, select: { admin: { select: { email: true } } } });
  return !!c && excuseAllowed(c.admin.email);
}

/** Who this staff session is, for visibility.ts: a teacher's own assigned groups, never what the course lets her browse. */
export async function staffViewer(session: Session): Promise<CourseViewer> {
  if (session.role === "admin") {
    const a = await prisma.admin.findUnique({ where: { id: session.adminId }, select: { gender: true } });
    return { kind: "SUPERVISOR", gender: a?.gender ?? null };
  }
  const [t, groups] = await Promise.all([
    prisma.teacher.findUnique({ where: { id: session.teacherId }, select: { gender: true } }),
    prisma.teacherGroupAssignment.findMany({ where: { teacherId: session.teacherId }, select: { groupId: true } }),
  ]);
  return { kind: "TEACHER", gender: t?.gender ?? null, groupIds: groups.map((g) => g.groupId) };
}

export type CourseExcuse = {
  // her excuses count in her scores (whoever looks)
  count: boolean;
  // the one looking sees it (past excuses too, after the switch is off)
  show: boolean;
  // the switch is on and they may act on it: the item setting
  act: boolean;
  // act, and the tracker is on: the excuse button
  on: boolean;
  // staff who may record «معذورة» in attendance
  mark: boolean;
  you: "MALE" | "FEMALE";
};

const NONE: CourseExcuse = { count: false, show: false, act: false, on: false, mark: false, you: "FEMALE" };

const STUDENT_SELECT = {
  id: true,
  groupId: true,
  excuseParentVisible: true,
  group: { select: { gender: true } },
  course: { select: { excuseEnabled: true, trackerEnabled: true, studentLoginEnabled: true, admin: { select: { email: true } } } },
} as const;

/** What this viewer gets of this student's excuse. */
export async function excuseFor(studentId: string, viewer: CourseViewer): Promise<CourseExcuse> {
  if (!excuseEnabled()) return NONE;
  const s = await prisma.student.findUnique({ where: { id: studentId }, select: STUDENT_SELECT });
  if (!s || s.group.gender !== "GIRLS" || !excuseAllowed(s.course.admin.email)) return NONE;
  const student: CourseStudent = { id: s.id, groupId: s.groupId, groupGender: "GIRLS", parentVisible: s.excuseParentVisible };
  const act = courseActs(viewer, student, s.course.excuseEnabled);
  return {
    count: true,
    show: courseSees(viewer, student, true),
    act,
    on: act && s.course.trackerEnabled && s.course.studentLoginEnabled,
    mark: act && (viewer.kind === "SUPERVISOR" || viewer.kind === "TEACHER"),
    you: "FEMALE",
  };
}

/** Whether a staff viewer sees «معذورة» for a whole group. */
export const groupSees = (viewer: CourseViewer, groupId: string, gender: CourseStudent["groupGender"]) =>
  courseSees(viewer, { id: "", groupId, groupGender: gender, parentVisible: false }, true);

/** Every one of these students may be marked «معذورة» by this viewer. */
export async function mayMarkExcused(studentIds: string[], viewer: CourseViewer): Promise<boolean> {
  if (studentIds.length === 0) return false;
  const rows = await Promise.all(studentIds.map((id) => excuseFor(id, viewer)));
  return rows.every((r) => r.mark);
}

// ---------- her excuses ----------

const ROW = { id: true, startDay: true, startMin: true, endDay: true, endMin: true, keepOriginal: true, keepExcused: true } as const;

/** Her excuses that reach fromDay or later (the open one included), oldest first. */
export async function loadStudentExcuses(studentId: string, fromDay: string): Promise<Excuse[]> {
  const rows = await prisma.studentExcuse.findMany({
    where: { studentId, OR: [{ endDay: null }, { endDay: { gte: dateOnly(fromDay) } }] },
    orderBy: { startDay: "asc" },
    select: ROW,
  });
  return rows.map(toExcuse);
}

const openOf = (studentId: string) => prisma.studentExcuse.findFirst({ where: { studentId, endDay: null }, select: ROW });

async function zoneOf(studentId: string) {
  const { courseId } = await prisma.student.findUniqueOrThrow({ where: { id: studentId }, select: { courseId: true } });
  return { courseId, tz: await courseTimeZone(courseId) };
}

/** What a boundary keeps as it was (boundaryKeys): her items of that day with their time then, and her ticks since. */
async function keysAt(studentId: string, at: Moment, today: string, courseId: string, tz: string): Promise<string[]> {
  const [s, course] = await Promise.all([
    prisma.student.findUniqueOrThrow({ where: { id: studentId }, select: { id: true, courseId: true, groupId: true } }),
    prisma.course.findUniqueOrThrow({ where: { id: courseId }, select: { trackerAgendaEnabled: true } }),
  ]);
  const agenda = course.trackerAgendaEnabled;
  const [items, own, ticks] = await Promise.all([
    prisma.trackerItem.findMany({
      where: { AND: [itemsForStudentWhere(s), { OR: [{ archivedAt: null }, { archivedAt: { gte: dateOnly(addDays(at.day, -1)) } }] }] },
      select: { id: true, days: true, slots: { select: { weekdays: true, startMin: true, durationMin: true, anchor: true, anchorOffsetMin: true } } },
    }),
    agenda
      ? prisma.trackerStudentSlot.findMany({ where: { studentId }, select: { itemId: true, weekdays: true, startMin: true, durationMin: true, anchor: true, anchorOffsetMin: true } })
      : [],
    prisma.trackerCheck.findMany({ where: { studentId, day: { gte: dateOnly(at.day), lte: dateOnly(today) } }, select: { itemId: true, day: true } }),
  ]);
  const place = agenda ? await coursePlace(courseId) : null;
  const prayers = place ? prayerMinutes(place, at.day, tz) : null;
  const timed = items
    .filter((i) => isActiveOn(i.days, at.day))
    .map((i) => ({
      id: i.id,
      startMin: agenda
        ? (resolveTiming(effectiveTiming(own.filter((o) => o.itemId === i.id), i.slots, weekdayOf(at.day)).timing, prayers)?.startMin ?? null)
        : null,
    }));
  const byDay: Record<string, string[]> = {};
  for (const c of ticks) (byDay[isoOf(c.day)] ??= []).push(c.itemId);
  return boundaryKeys(at, today, timed, byDay);
}

// teacherId: staff's Teacher row (the supervisor's stand-in included); null: she herself
type By = { teacherId: string | null };
const actorOf = (by: By) => (by.teacherId ? "STAFF" : "SELF");

async function close(studentId: string, id: string, at: Moment, now: Moment, where: { courseId: string; tz: string }, by: { actor: "SELF" | "STAFF" | "AUTO"; teacherId: string | null }) {
  const keepExcused = await keysAt(studentId, at, now.day, where.courseId, where.tz);
  await prisma.studentExcuse.updateMany({
    where: { id, endDay: null },
    data: { endDay: dateOnly(at.day), endMin: at.min, keepExcused, endedBy: by.actor, endedByTeacherId: by.teacherId },
  });
}

/** An open excuse past its 15 days ends at its cap. true: it just did. */
export async function settleStudentExpired(studentId: string): Promise<boolean> {
  const where = await zoneOf(studentId);
  const now = nowIn(where.tz);
  const open = await openOf(studentId);
  const eff = open && effectiveEnd(toExcuse(open), now);
  if (!open || !eff?.auto) return false;
  // nobody pressed: only the cap day's own ticks stay excused
  await close(studentId, open.id, eff.end, { day: eff.end.day, min: now.min }, where, { actor: "AUTO", teacherId: null });
  return true;
}

const errorOf = (e: MomentError, you: "MALE" | "FEMALE", other: Moment | null, today: string) => ({ error: momentErrorText(e, you, other, today) });

/** «بدء العذر»: from now or an earlier moment (today or yesterday). */
export async function startStudentExcuse(studentId: string, input: MomentInput, you: "MALE" | "FEMALE", by: By): Promise<ExcuseResult> {
  const where = await zoneOf(studentId);
  const now = nowIn(where.tz);
  const autoEnded = await settleStudentExpired(studentId);
  if (await openOf(studentId)) return { autoEnded };
  const read = readMoment(input, now);
  const at = read === "TOO_EARLY" ? null : read;
  const last = await prisma.studentExcuse.findFirst({ where: { studentId, endDay: { not: null } }, orderBy: [{ endDay: "desc" }, { endMin: "desc" }], select: ROW });
  const lastEnd = last ? toExcuse(last).end : null;
  const problem = read === "TOO_EARLY" ? "TOO_EARLY" : checkStart(at, now, lastEnd);
  if (problem || !at) return errorOf(problem ?? "NO_TIME", you, lastEnd, now.day);
  try {
    await prisma.studentExcuse.create({
      data: {
        studentId,
        startDay: dateOnly(at.day),
        startMin: at.min,
        keepOriginal: await keysAt(studentId, at, now.day, where.courseId, where.tz),
        startedBy: actorOf(by),
        startedByTeacherId: by.teacherId,
      },
    });
  } catch (e) {
    // started meanwhile (another tab, or her teacher): already as wanted
    if (!(e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002")) throw e;
  }
  return { autoEnded };
}

/** «انتهى العذر»: now or an earlier moment, after its start. */
export async function endStudentExcuse(studentId: string, input: MomentInput, you: "MALE" | "FEMALE", by: By): Promise<ExcuseResult> {
  const where = await zoneOf(studentId);
  const now = nowIn(where.tz);
  if (await settleStudentExpired(studentId)) return { autoEnded: true };
  const open = await openOf(studentId);
  // ended meanwhile: already as wanted
  if (!open) return {};
  const start = toExcuse(open).start;
  const read = readMoment(input, now);
  const at = read === "TOO_EARLY" ? null : read;
  const problem = read === "TOO_EARLY" ? "TOO_EARLY" : checkEnd(at, now, start);
  if (problem || !at) return errorOf(problem ?? "NO_TIME", you, start, now.day);
  await close(studentId, open.id, at, now, where, { actor: actorOf(by), teacherId: by.teacherId });
  return {};
}

/** Turning the course's switch off ends every open excuse now (decision A4). */
export async function endAllOnCourseOff(courseId: string, teacherId: string): Promise<void> {
  const tz = await courseTimeZone(courseId);
  const now = nowIn(tz);
  const open = await prisma.studentExcuse.findMany({ where: { endDay: null, student: { courseId } }, select: { ...ROW, studentId: true } });
  for (const o of open) {
    if (await settleStudentExpired(o.studentId)) continue;
    const start = toExcuse(o).start;
    // started this very minute: ends a minute later rather than before it began
    const later = start.min < 1439 ? { day: start.day, min: start.min + 1 } : { day: addDays(start.day, 1), min: 0 };
    const at = checkEnd(now, now, start) === "BEFORE_START" ? later : now;
    await close(o.studentId, o.id, at, now, { courseId, tz }, { actor: "STAFF", teacherId });
  }
}

// ---------- for the pages ----------

const WHO = { isSupervisorProxy: true, name: true } as const;

async function actorOfRow(kind: string | null, teacher: { isSupervisorProxy: boolean; name: string } | null, courseId: string): Promise<Actor | "AUTO" | null> {
  if (kind === "AUTO") return "AUTO";
  if (kind === "SELF") return { kind: "STUDENT" };
  if (!teacher) return null;
  if (!teacher.isSupervisorProxy) return { kind: "TEACHER", name: teacher.name };
  const c = await prisma.course.findUniqueOrThrow({ where: { id: courseId }, select: { admin: { select: { gender: true } } } });
  return { kind: "SUPERVISOR", gender: c.admin.gender };
}

/** What «جدول المتابعة» gets of her excuse (only for whoever sees it). record: C14, who started the open one. */
export async function studentTrackerExcuse(studentId: string, ex: CourseExcuse, record = true): Promise<TrackerExcuse | undefined> {
  if (!ex.show) return undefined;
  const { courseId, tz } = await zoneOf(studentId);
  const excuses = await loadStudentExcuses(studentId, addDays(nowIn(tz).day, -10));
  const open = record
    ? await prisma.studentExcuse.findFirst({ where: { studentId, endDay: null }, select: { startedBy: true, startedByTeacher: { select: WHO } } })
    : null;
  const starter = open ? await actorOfRow(open.startedBy, open.startedByTeacher, courseId) : null;
  return { excuses, on: ex.on, pausedNow: false, you: ex.you, startedBy: starter === "AUTO" ? null : starter };
}

/** G9: «آخر عذر: 10 – 16 أكتوبر · أنهته الطالبة» (null: she has had none). */
export async function lastExcuseRecord(studentId: string): Promise<string | null> {
  const { courseId } = await zoneOf(studentId);
  const r = await prisma.studentExcuse.findFirst({
    where: { studentId, endDay: { not: null } },
    orderBy: [{ endDay: "desc" }, { endMin: "desc" }],
    select: { startDay: true, endDay: true, endedBy: true, endedByTeacher: { select: WHO } },
  });
  return r ? lastExcuseLine(isoOf(r.startDay), isoOf(r.endDay!), await actorOfRow(r.endedBy, r.endedByTeacher, courseId)) : null;
}

/** Per student, the «day:itemId» pairs not due from fromDay to tomorrow (only those with any). */
async function studentSkipKeys(students: { id: string; courseId: string; groupId: string }[], fromDay: string, tz: string): Promise<Record<string, string[]>> {
  if (students.length === 0) return {};
  const excuses = await prisma.studentExcuse.findMany({
    where: { studentId: { in: students.map((s) => s.id) }, OR: [{ endDay: null }, { endDay: { gte: dateOnly(fromDay) } }] },
    orderBy: { startDay: "asc" },
    select: { ...ROW, studentId: true },
  });
  const now = nowIn(tz);
  const out: Record<string, string[]> = {};
  for (const s of students) {
    const mine = excuses.filter((e) => e.studentId === s.id).map(toExcuse);
    if (mine.length === 0) continue;
    const skips = await prisma.trackerItem.findMany({ where: { AND: [itemsForStudentWhere(s), { excuseMode: "SKIP" }] }, select: { id: true, excuseMode: true } });
    if (skips.length === 0) continue;
    const lens = excuseLens(skips, mine, now);
    const keys: string[] = [];
    for (let d = fromDay; d <= addDays(now.day, 1); d = addDays(d, 1)) for (const i of skips) if (lens.skipped(i.id, d)) keys.push(keyOf(d, i.id));
    if (keys.length) out[s.id] = keys;
  }
  return out;
}

/** For a viewer who may not see it while it counts: only the «day:itemId» pairs not due (quietLens). */
export async function studentTrackerQuiet(studentId: string, ex: CourseExcuse, days = 17): Promise<string[] | undefined> {
  if (!ex.count || ex.show) return undefined;
  const s = await prisma.student.findUniqueOrThrow({ where: { id: studentId }, select: { id: true, courseId: true, groupId: true } });
  const tz = await courseTimeZone(s.courseId);
  return (await studentSkipKeys([s], addDays(nowIn(tz).day, -days), tz))[studentId] ?? [];
}

/**
 * The group's overview on /tracker: skip, what isn't due per student (the
 * scores leave it out for every viewer, with nothing else of it); excused,
 * who is excused now, only for a viewer who may see it (G10).
 */
export async function groupTrackerExcuse(groupId: string, viewer: CourseViewer): Promise<{ skip: Record<string, string[]>; excused: string[] }> {
  const none = { skip: {}, excused: [] };
  if (!excuseEnabled()) return none;
  const g = await prisma.group.findUnique({ where: { id: groupId }, select: { gender: true, courseId: true } });
  if (!g || g.gender !== "GIRLS" || !(await courseExcuseAllowed(g.courseId))) return none;
  const tz = await courseTimeZone(g.courseId);
  const students = await prisma.student.findMany({ where: { groupId, archivedAt: null }, select: { id: true, courseId: true, groupId: true } });
  const skip = await studentSkipKeys(students, addDays(nowIn(tz).day, -17), tz);
  if (!groupSees(viewer, groupId, g.gender)) return { skip, excused: [] };
  const now = nowIn(tz);
  const open = await prisma.studentExcuse.findMany({ where: { endDay: null, studentId: { in: students.map((s) => s.id) } }, select: { ...ROW, studentId: true } });
  return { skip, excused: open.filter((o) => isActive(toExcuse(o), now)).map((o) => o.studentId) };
}

/** For her goal: the days marked «معذورة» leave its count; show: this viewer may know (otherwise neutralGoal). */
export async function goalExcuse(studentId: string, ex: CourseExcuse): Promise<{ paused: Set<string>; show: boolean } | undefined> {
  if (!ex.count) return undefined;
  const logs = await prisma.attendanceLog.findMany({ where: { studentId, status: "EXCUSED" }, select: { day: true, status: true } });
  return { paused: excusedDays(logs), show: ex.show };
}
