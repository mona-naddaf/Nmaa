import "server-only";
import { prisma } from "@/lib/db";
import { AYAH_COUNT } from "@/lib/quran-data";
import { deriveCurrentPosition, deriveReach, nextExpectedEntry } from "@/lib/recitation/logic";
import { trackContext, trackProgress } from "@/lib/recitation/tracks";
import { PLAN_FIELDS, forPlanPosition, studentPlan } from "@/lib/students/plan";
import type { GroupGender } from "@/lib/text/gender";
import type { SheetGroup } from "./template";

/**
 * The sheet's groups with their active students, each with where her new
 * memorization continues from — and, for a student with a second track,
 * where that track continues (no pre-fill for a «حر» track or a complete one).
 */
export async function sheetGroupsFor(courseId: string, groups: { id: string; name: string; gender: GroupGender }[]): Promise<SheetGroup[]> {
  const students = await prisma.student.findMany({
    where: { courseId, groupId: { in: groups.map((g) => g.id) }, archivedAt: null },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      groupId: true,
      ...PLAN_FIELDS,
      recitationSessions: {
        select: { surahNumber: true, fromAyah: true, toAyah: true, type: true, situation: true, reason: true, createdAt: true, trackId: true },
      },
    },
  });

  return groups.map((g) => ({
    ...g,
    students: students
      .filter((s) => s.groupId === g.id)
      .map((s) => {
        const sp = studentPlan(s);
        const { plan, planChangedAt } = sp;
        let next: { surahNumber: number; fromAyah: number } | null = null;
        if (plan.length > 0) {
          const position = deriveCurrentPosition(plan, deriveReach(plan, forPlanPosition(s.recitationSessions, planChangedAt)));
          // the whole plan done: nothing to continue from
          const last = plan[plan.length - 1];
          if (!(position && position.surahNumber === last && position.ayah >= AYAH_COUNT[last])) {
            const n = nextExpectedEntry(plan, position);
            next = { surahNumber: n.surahNumber, fromAyah: n.fromAyah };
          }
        }
        if (!sp.second) return { id: s.id, name: s.name, next };
        const ctx = trackContext(sp.second, s.recitationSessions);
        const n = ctx ? trackProgress(sp.second, ctx).next : null;
        return { id: s.id, name: s.name, next, second: { next: n ? { surahNumber: n.surahNumber, fromAyah: n.fromAyah } : null } };
      }),
  }));
}
