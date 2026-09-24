import "server-only";
import { prisma } from "@/lib/db";
import { deriveFurthestPosition, type FurthestPosition } from "@/lib/recitation/logic";
import { buildCoverage, coveredQuranPages } from "@/lib/students/progress";
import { TOTAL_PAGES } from "@/lib/quran-data";
import type { GroupGender } from "@/lib/text/gender";

// The ONLY data source for the parent view. Every query here is keyed on the
// single studentId from the parent session — never a courseId or groupId —
// and uses explicit `select`s so fields parents shouldn't see (teacher notes,
// gap/edit reasons, other students) are never loaded, let alone sent.

export interface ParentHistoryEntry {
  id: string;
  date: string; // YYYY-MM-DD
  source: "LOGGED" | "PRIOR";
  type: "NEW" | "REVIEW" | "LINK";
  surahNumber: number;
  fromAyah: number;
  toAyah: number;
  pages: number;
  quality: "EXCELLENT" | "GOOD" | "NEEDS_REPEAT" | null;
  teacherName: string;
}

export interface ParentViewData {
  studentName: string;
  groupName: string;
  groupGender: GroupGender;
  courseName: string;
  furthest: FurthestPosition | null;
  quranPercent: number;
  history: ParentHistoryEntry[];
  attendance: { date: string; status: "IN" | "OUT" }[];
  points: { date: string; activityName: string; value: number }[];
}

export async function getParentViewData(studentId: string): Promise<ParentViewData | null> {
  const student = await prisma.student.findUnique({
    where: { id: studentId },
    select: {
      name: true,
      group: { select: { name: true, gender: true } },
      course: { select: { name: true } },
      planItems: { orderBy: { position: "asc" }, select: { surahNumber: true } },
    },
  });
  if (!student) return null;

  const [sessions, attendanceLogs, pointsLogs] = await Promise.all([
    prisma.recitationSession.findMany({
      where: { studentId },
      orderBy: [{ occurredAt: "desc" }, { id: "desc" }],
      select: {
        id: true,
        occurredAt: true,
        source: true,
        type: true,
        surahNumber: true,
        fromAyah: true,
        toAyah: true,
        pagesCalculated: true,
        quality: true,
        teacher: { select: { name: true } },
      },
    }),
    prisma.attendanceLog.findMany({
      where: { studentId, status: { in: ["IN", "OUT"] } },
      select: { day: true, status: true },
    }),
    prisma.pointsLog.findMany({
      where: { studentId },
      select: { day: true, valueAtTime: true, typeAtTime: true, activity: { select: { name: true } } },
    }),
  ]);

  const plan = student.planItems.map((p) => p.surahNumber);
  const coverage = buildCoverage(sessions);

  return {
    studentName: student.name,
    groupName: student.group.name,
    groupGender: student.group.gender,
    courseName: student.course.name,
    furthest: deriveFurthestPosition(plan, sessions),
    quranPercent: Math.min(100, Math.round((coveredQuranPages(coverage) / TOTAL_PAGES) * 1000) / 10),
    history: sessions.map((s) => ({
      id: s.id,
      date: s.occurredAt.toISOString().slice(0, 10),
      source: s.source,
      type: s.type,
      surahNumber: s.surahNumber,
      fromAyah: s.fromAyah,
      toAyah: s.toAyah,
      pages: Number(s.pagesCalculated),
      quality: s.quality,
      teacherName: s.teacher.name,
    })),
    attendance: attendanceLogs.map((a) => ({
      date: a.day.toISOString().slice(0, 10),
      status: a.status as "IN" | "OUT",
    })),
    points: pointsLogs.map((p) => ({
      date: p.day.toISOString().slice(0, 10),
      activityName: p.activity.name,
      value: p.typeAtTime === "ADD" ? p.valueAtTime : -p.valueAtTime,
    })),
  };
}
