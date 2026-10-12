import "server-only";
import { prisma } from "@/lib/db";
import { deriveCurrentPosition, deriveReach, type PlanPosition } from "@/lib/recitation/logic";
import { PLAN_FIELDS, forPlanPosition, secondTrackView, studentPlan } from "@/lib/students/plan";
import { buildCoverage, coveredQuranPages } from "@/lib/students/progress";
import { TOTAL_PAGES } from "@/lib/quran-data";
import type { GroupGender } from "@/lib/text/gender";
import { getActiveMistakes } from "@/lib/students/mistakes";
import { groupCombos } from "@/lib/recitation/combined";
import { BONUS_POINTS_LABEL } from "@/lib/points/bonus";
import type { ActiveMistake } from "@/lib/students/mistake-types";
import { getHomeLog, type HomeLogView } from "@/lib/home-log/data";
import { getStudentAssignments, type StudentAssignment } from "@/lib/assignments/data";
import { getStudentTracker, type TrackerSheet } from "@/lib/tracker/data";
import { getStudentInfoValues, parentInfoAccess, plainValues, visibleInfoFields } from "@/lib/students/extra-info";
import type { InfoField } from "@/lib/students/extra-info-rules";

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
  // one recitation saved as parts (new memorization + «ربط»): shown as one entry
  parts?: { type: "NEW" | "REVIEW" | "LINK"; fromAyah: number; toAyah: number }[];
}

export interface ParentViewData {
  studentName: string;
  groupName: string;
  groupGender: GroupGender;
  courseName: string;
  position: PlanPosition | null;
  // her second track (type and start, and where it stands), when she has one
  secondTrack: { title: string; positionText: string } | null;
  quranPercent: number;
  // unresolved flagged words to practise at home (word, place, type, date — no teacher details)
  mistakes: ActiveMistake[];
  history: ParentHistoryEntry[];
  attendance: { date: string; status: "IN" | "OUT" }[];
  points: { date: string; activityName: string; value: number }[];
  // read-only home memorization log (D4); null when the course has it off
  homeLog: HomeLogView | null;
  // read-only assignments (D1); null when the course has them off
  assignments: StudentAssignment[] | null;
  // read-only daily tracker (D1); null when the course has it off
  tracker: TrackerSheet | null;
  // «معلومات الطالب/ة», which the parent may fill/edit: only the fields
  // shown to parents. null unless the course has the feature and parent
  // editing on.
  info: { fields: InfoField[]; values: Record<string, string> } | null;
}

export async function getParentViewData(studentId: string): Promise<ParentViewData | null> {
  const student = await prisma.student.findUnique({
    where: { id: studentId },
    select: {
      name: true,
      group: { select: { name: true, gender: true } },
      course: {
        select: {
          id: true,
          name: true,
          homeLogEnabled: true,
          studentLoginEnabled: true,
          assignmentsEnabled: true,
          trackerEnabled: true,
          studentInfoEnabled: true,
          parentStudentInfoEdit: true,
        },
      },
      ...PLAN_FIELDS,
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
        comboId: true,
        situation: true,
        reason: true,
        createdAt: true,
        trackId: true,
        teacher: { select: { name: true } },
      },
    }),
    prisma.attendanceLog.findMany({
      where: { studentId, status: { in: ["IN", "OUT"] } },
      select: { day: true, status: true },
    }),
    prisma.pointsLog.findMany({
      where: { studentId },
      // a stable order, so same-day points never shuffle
      orderBy: [{ day: "asc" }, { createdAt: "asc" }, { id: "asc" }],
      select: { day: true, valueAtTime: true, typeAtTime: true, activity: { select: { name: true } } },
    }),
  ]);

  const sp = studentPlan(student);
  const { plan } = sp;
  const second = secondTrackView(sp, sessions, student.group.gender);
  const infoFields = await visibleInfoFields(student.course.id, parentInfoAccess(student.course));
  const coverage = buildCoverage(sessions);

  return {
    studentName: student.name,
    groupName: student.group.name,
    groupGender: student.group.gender,
    courseName: student.course.name,
    // as the staff page and the student portal read it (a manual plan change, a second track's approvals)
    position: deriveCurrentPosition(plan, deriveReach(plan, forPlanPosition(sessions, sp.planChangedAt))),
    secondTrack: second ? { title: second.title, positionText: second.positionText } : null,
    mistakes: await getActiveMistakes(studentId, plan),
    quranPercent: Math.min(100, Math.round((coveredQuranPages(coverage) / TOTAL_PAGES) * 1000) / 10),
    history: groupCombos(sessions).map((s) => ({
      id: s.id,
      date: s.occurredAt.toISOString().slice(0, 10),
      source: s.source,
      type: s.type,
      surahNumber: s.surahNumber,
      fromAyah: s.fromAyah,
      toAyah: s.toAyah,
      pages: s.parts ? s.parts.reduce((sum, p) => sum + Number(p.pagesCalculated), 0) : Number(s.pagesCalculated),
      quality: s.quality,
      teacherName: s.teacher.name,
      ...(s.parts ? { parts: s.parts.map((p) => ({ type: p.type, fromAyah: p.fromAyah, toAyah: p.toAyah })) } : {}),
    })),
    attendance: attendanceLogs.map((a) => ({
      date: a.day.toISOString().slice(0, 10),
      status: a.status as "IN" | "OUT",
    })),
    homeLog: student.course.homeLogEnabled && student.course.studentLoginEnabled ? await getHomeLog(studentId) : null,
    assignments: student.course.assignmentsEnabled && student.course.studentLoginEnabled ? await getStudentAssignments(studentId) : null,
    tracker: student.course.trackerEnabled && student.course.studentLoginEnabled ? await getStudentTracker(studentId) : null,
    info:
      infoFields.length > 0
        ? { fields: infoFields, values: plainValues(await getStudentInfoValues(studentId, infoFields)) }
        : null,
    points: pointsLogs.map((p) => ({
      date: p.day.toISOString().slice(0, 10),
      // bonus rows group under one label; their notes are teacher-written
      // and deliberately not selected for parents
      activityName: p.activity?.name ?? BONUS_POINTS_LABEL,
      value: p.typeAtTime === "ADD" ? p.valueAtTime : -p.valueAtTime,
    })),
  };
}
