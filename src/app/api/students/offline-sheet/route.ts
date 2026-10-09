import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { AYAH_COUNT } from "@/lib/quran-data";
import { deriveCurrentPosition, deriveReach, nextExpectedEntry } from "@/lib/recitation/logic";
import { getOfflineAccess } from "@/lib/offline-sheet/access";
import { riyadhTodayISO } from "@/lib/offline-sheet/dates";
import { buildOfflineSheet, type SheetGroup } from "@/lib/offline-sheet/template";

// «التسميع بدون إنترنت»: the day's sheet for one group or all the groups she
// may use (getOfflineAccess), active students only, built fresh on every
// request so the students and each one's next ayah are current.
export async function GET(request: NextRequest) {
  const session = await getSession();
  const access = session ? await getOfflineAccess(session) : null;
  if (!access) return new NextResponse("غير مصرّح", { status: 403 });

  const wanted = request.nextUrl.searchParams.get("group") ?? "all";
  const groups = wanted === "all" ? access.groups : access.groups.filter((g) => g.id === wanted);
  if (groups.length === 0) {
    return new NextResponse(wanted === "all" ? "لا توجد مجموعات متاحة" : "غير مصرّح", { status: wanted === "all" ? 409 : 403 });
  }

  const students = await prisma.student.findMany({
    where: { courseId: access.courseId, groupId: { in: groups.map((g) => g.id) }, archivedAt: null },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      groupId: true,
      planItems: { orderBy: { position: "asc" }, select: { surahNumber: true } },
      recitationSessions: { select: { surahNumber: true, fromAyah: true, toAyah: true, type: true, situation: true, reason: true } },
    },
  });

  const sheetGroups: SheetGroup[] = groups.map((g) => ({
    ...g,
    students: students
      .filter((s) => s.groupId === g.id)
      .map((s) => {
        const plan = s.planItems.map((p) => p.surahNumber);
        if (plan.length === 0) return { id: s.id, name: s.name, next: null };
        const position = deriveCurrentPosition(plan, deriveReach(plan, s.recitationSessions));
        // the whole plan done: nothing to continue from
        const last = plan[plan.length - 1];
        if (position && position.surahNumber === last && position.ayah >= AYAH_COUNT[last]) return { id: s.id, name: s.name, next: null };
        const next = nextExpectedEntry(plan, position);
        return { id: s.id, name: s.name, next: { surahNumber: next.surahNumber, fromAyah: next.fromAyah } };
      }),
  }));

  const dateISO = riyadhTodayISO();
  const buffer = await buildOfflineSheet({ groups: sheetGroups, dateISO, viewerGender: access.viewerGender });
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="ala-mukth-tasmee-${dateISO}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
