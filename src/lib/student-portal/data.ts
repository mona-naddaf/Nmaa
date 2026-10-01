import "server-only";
import { prisma } from "@/lib/db";
import { deriveCurrentPosition, deriveReach, type PlanPosition } from "@/lib/recitation/logic";
import { buildCoverage, computeProgressBars, coveredQuranPages, type ProgressBar } from "@/lib/students/progress";
import { getActiveMistakes } from "@/lib/students/mistakes";
import { TOTAL_PAGES } from "@/lib/quran-data";
import { BONUS_POINTS_LABEL } from "@/lib/points/bonus";
import type { ActiveMistake } from "@/lib/students/mistake-types";
import type { GroupGender } from "@/lib/text/gender";

// The ONLY data source for the student's own page. Every query is keyed on
// the single studentId from the student session, with explicit selects:
// no teacher names or notes, no other students. Recitation situation/reason
// are read only to work out her position (same as the staff page) and are
// never returned. Phases 2–3 add their own loaders next to this one.

export interface StudentHomeData {
  studentName: string;
  groupName: string;
  groupGender: GroupGender;
  courseName: string;
  position: PlanPosition | null;
  quranPercent: number;
  // the bars the course has turned on (may be empty)
  progressBars: ProgressBar[];
  mistakes: ActiveMistake[];
  points: { date: string; activityName: string; value: number }[];
}

export async function getStudentHomeData(studentId: string): Promise<StudentHomeData | null> {
  const student = await prisma.student.findUnique({
    where: { id: studentId },
    select: {
      name: true,
      group: { select: { name: true, gender: true } },
      course: {
        select: { name: true, showSurahProgress: true, showJuzProgress: true, showQuranProgress: true, showPlanProgress: true },
      },
      planItems: { orderBy: { position: "asc" }, select: { surahNumber: true } },
    },
  });
  if (!student) return null;

  const [sessions, pointsLogs] = await Promise.all([
    prisma.recitationSession.findMany({
      where: { studentId },
      orderBy: [{ occurredAt: "desc" }, { id: "desc" }],
      select: { surahNumber: true, fromAyah: true, toAyah: true, type: true, situation: true, reason: true },
    }),
    prisma.pointsLog.findMany({
      where: { studentId },
      select: { day: true, valueAtTime: true, typeAtTime: true, activity: { select: { name: true } } },
    }),
  ]);

  const plan = student.planItems.map((p) => p.surahNumber);
  const position = deriveCurrentPosition(plan, deriveReach(plan, sessions));
  const coverage = buildCoverage(sessions);

  return {
    studentName: student.name,
    groupName: student.group.name,
    groupGender: student.group.gender,
    courseName: student.course.name,
    position,
    quranPercent: Math.min(100, Math.round((coveredQuranPages(coverage) / TOTAL_PAGES) * 1000) / 10),
    progressBars: computeProgressBars({ settings: student.course, plan, position, coverage }),
    mistakes: await getActiveMistakes(studentId, plan),
    points: pointsLogs.map((p) => ({
      date: p.day.toISOString().slice(0, 10),
      // bonus notes are teacher-written and deliberately not selected
      activityName: p.activity?.name ?? BONUS_POINTS_LABEL,
      value: p.typeAtTime === "ADD" ? p.valueAtTime : -p.valueAtTime,
    })),
  };
}
