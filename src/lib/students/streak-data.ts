import "server-only";
import { prisma } from "@/lib/db";
import { zoneDateOnly, zoneDateOnlyOf } from "@/lib/time/zone";
import { computeStreak, weekIndex, type StreakMode } from "@/lib/students/streak";
import { excuseEnabled } from "@/lib/excuse/enabled";
import { excusedWeeks } from "@/lib/excuse/attendance";

/**
 * Current streak for each of `students`, which must include every member of
 * their groups — a week's neutrality depends on the whole group's activity.
 * Weeks run on the course's days (its time zone, lib/time/zone.ts).
 * Only the dates of qualifying events are loaded:
 *  - ATTENDANCE: days marked present (IN)
 *  - RECITATION: logged sessions of any type; PRIOR baselines are the
 *    student's declared starting point, not a recitation that week.
 */
export async function computeStreaks(
  mode: StreakMode,
  students: { id: string; groupId: string }[],
  timeZone: string,
  now: Date = new Date(),
): Promise<Map<string, number>> {
  const ids = students.map((s) => s.id);
  const events: { studentId: string; date: Date }[] =
    mode === "ATTENDANCE"
      ? (
          await prisma.attendanceLog.findMany({
            where: { studentId: { in: ids }, status: "IN" },
            select: { studentId: true, day: true },
          })
        ).map((a) => ({ studentId: a.studentId, date: a.day }))
      : (
          await prisma.recitationSession.findMany({
            where: { studentId: { in: ids }, source: "LOGGED" },
            select: { studentId: true, occurredAt: true },
          })
        ).map((s) => ({ studentId: s.studentId, date: zoneDateOnlyOf(timeZone, s.occurredAt) }));

  const groupOf = new Map(students.map((s) => [s.id, s.groupId]));
  const studentWeeks = new Map<string, Set<number>>();
  const groupWeeks = new Map<string, Set<number>>();
  for (const e of events) {
    const w = weekIndex(e.date);
    const group = groupOf.get(e.studentId)!;
    if (!studentWeeks.has(e.studentId)) studentWeeks.set(e.studentId, new Set());
    if (!groupWeeks.has(group)) groupWeeks.set(group, new Set());
    studentWeeks.get(e.studentId)!.add(w);
    groupWeeks.get(group)!.add(w);
  }

  // «معذورة» (lib/excuse/attendance.ts): a week holding one and no absence is neutral for her
  const excused = new Map<string, Set<number>>();
  if (excuseEnabled()) {
    const marked = await prisma.attendanceLog.findMany({ where: { studentId: { in: ids }, status: "EXCUSED" }, select: { studentId: true } });
    const who = [...new Set(marked.map((m) => m.studentId))];
    if (who.length > 0) {
      const logs = await prisma.attendanceLog.findMany({
        where: { studentId: { in: who }, status: { in: ["EXCUSED", "OUT"] } },
        select: { studentId: true, day: true, status: true },
      });
      for (const id of who) excused.set(id, excusedWeeks(logs.filter((l) => l.studentId === id)));
    }
  }

  const currentWeek = weekIndex(zoneDateOnly(timeZone, now));
  return new Map(
    students.map((s) => [
      s.id,
      computeStreak(studentWeeks.get(s.id) ?? new Set(), groupWeeks.get(s.groupId) ?? new Set(), currentWeek, excused.get(s.id)),
    ]),
  );
}
