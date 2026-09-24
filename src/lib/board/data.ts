import "server-only";
import { prisma } from "@/lib/db";
import { getLeaderboardData, type DailyEntry, type LeaderboardStudent } from "@/lib/leaderboard/data";

// The ONLY data source for the public board. Keyed on the courseId from the
// board session, it returns exactly what the staff leaderboard shows (names,
// group names, daily pages/points — prior memorization already excluded)
// with every database id swapped for an opaque list position, so nothing a
// public visitor receives identifies a row in the database.

export interface BoardData {
  courseName: string;
  students: LeaderboardStudent[];
  groups: { id: string; name: string }[];
  dailyEntries: DailyEntry[];
}

export async function getBoardData(courseId: string): Promise<BoardData | null> {
  const course = await prisma.course.findUnique({ where: { id: courseId }, select: { name: true } });
  if (!course) return null;

  const [{ students, dailyEntries }, groups] = await Promise.all([
    getLeaderboardData(courseId),
    prisma.group.findMany({ where: { courseId }, orderBy: { sortOrder: "asc" }, select: { id: true, name: true } }),
  ]);

  const groupKey = new Map(groups.map((g, i) => [g.id, `g${i}`]));
  const studentKey = new Map(students.map((s, i) => [s.id, `s${i}`]));

  return {
    courseName: course.name,
    groups: groups.map((g) => ({ id: groupKey.get(g.id)!, name: g.name })),
    students: students.map((s) => ({
      id: studentKey.get(s.id)!,
      name: s.name,
      groupId: groupKey.get(s.groupId) ?? "",
      groupName: s.groupName,
    })),
    dailyEntries: dailyEntries
      .filter((e) => studentKey.has(e.studentId))
      .map((e) => ({ ...e, studentId: studentKey.get(e.studentId)! })),
  };
}
