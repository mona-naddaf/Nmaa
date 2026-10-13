import "server-only";
import { prisma } from "@/lib/db";
import { computeGoal, type GoalSession, type GoalSpec, type GoalView } from "./goal";
import type { SessionType } from "@/lib/recitation/logic";
import { riyadhDay } from "./riyadh";

export { riyadhDay };

// A course student's goal as her pages show it. Courses count days in
// Riyadh time (as attendance does): a session counts for the Riyadh day it
// happened on (a backdated one is stored at noon UTC of its day, which is
// that same day in Riyadh).

const iso = (d: Date) => d.toISOString().slice(0, 10);

export function goalSpecOf(row: {
  target: GoalSpec["target"];
  juz: number | null;
  surah: number | null;
  ayah: number | null;
  startDay: Date;
  deadline: Date;
}): GoalSpec {
  return { target: row.target, juz: row.juz, surah: row.surah, ayah: row.ayah, startDay: iso(row.startDay), deadline: iso(row.deadline) };
}

export function courseGoalSessions(
  sessions: { surahNumber: number; fromAyah: number; toAyah: number; type: SessionType; source: string; occurredAt: Date }[],
): GoalSession[] {
  return sessions.map((s) => ({
    surahNumber: s.surahNumber,
    fromAyah: s.fromAyah,
    toAyah: s.toAyah,
    type: s.type,
    day: riyadhDay(s.occurredAt),
    prior: s.source === "PRIOR",
  }));
}

/** Her goal (null without one), with its stored spec for the editor. */
export async function getStudentGoal(
  studentId: string,
  plan: number[],
  sessions: Parameters<typeof courseGoalSessions>[0],
): Promise<{ spec: GoalSpec; view: GoalView } | null> {
  const row = await prisma.studentGoal.findUnique({ where: { studentId } });
  if (!row) return null;
  const spec = goalSpecOf(row);
  return { spec, view: computeGoal(plan, spec, courseGoalSessions(sessions), riyadhDay()) };
}
