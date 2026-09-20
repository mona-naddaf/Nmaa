import "server-only";
import { prisma } from "@/lib/db";

export interface LeaderboardStudent {
  id: string;
  name: string;
  groupId: string;
  groupName: string;
}

export interface DailyEntry {
  studentId: string;
  date: string; // YYYY-MM-DD
  pages: number;
  points: number;
}

export async function getLeaderboardData(courseId: string) {
  const students = await prisma.student.findMany({
    where: { courseId },
    include: { group: true },
    orderBy: { name: "asc" },
  });
  const studentIds = students.map((s) => s.id);

  const [sessions, pointsLogs] = await Promise.all([
    prisma.recitationSession.findMany({
      // prior-to-joining memorization isn't "achieved" during this course,
      // so it's excluded from the leaderboard entirely
      where: { studentId: { in: studentIds }, source: "LOGGED" },
      select: { studentId: true, occurredAt: true, pagesCalculated: true },
    }),
    prisma.pointsLog.findMany({
      where: { studentId: { in: studentIds } },
      select: { studentId: true, day: true, valueAtTime: true, typeAtTime: true },
    }),
  ]);

  const byKey = new Map<string, DailyEntry>();
  function bucket(studentId: string, date: string): DailyEntry {
    const key = `${studentId}|${date}`;
    let entry = byKey.get(key);
    if (!entry) {
      entry = { studentId, date, pages: 0, points: 0 };
      byKey.set(key, entry);
    }
    return entry;
  }

  for (const s of sessions) {
    const date = s.occurredAt.toISOString().slice(0, 10);
    bucket(s.studentId, date).pages += Number(s.pagesCalculated);
  }
  for (const p of pointsLogs) {
    const date = p.day.toISOString().slice(0, 10);
    bucket(p.studentId, date).points += p.typeAtTime === "ADD" ? p.valueAtTime : -p.valueAtTime;
  }

  const dailyEntries = [...byKey.values()].map((e) => ({
    ...e,
    pages: Math.round(e.pages * 1000) / 1000,
  }));

  return {
    students: students.map((s): LeaderboardStudent => ({
      id: s.id,
      name: s.name,
      groupId: s.groupId,
      groupName: s.group.name,
    })),
    dailyEntries,
  };
}
