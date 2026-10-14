import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getOfflineAccess } from "@/lib/offline-sheet/access";
import { courseTimeZone } from "@/lib/time/course-zone";
import { zoneToday } from "@/lib/time/zone";
import { buildOfflineSheet } from "@/lib/offline-sheet/template";
import { sheetGroupsFor } from "@/lib/offline-sheet/students";

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

  const sheetGroups = await sheetGroupsFor(access.courseId, groups);

  const dateISO = zoneToday(await courseTimeZone(access.courseId));
  const buffer = await buildOfflineSheet({ groups: sheetGroups, dateISO, viewerGender: access.viewerGender });
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="ala-mukth-tasmee-${dateISO}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
