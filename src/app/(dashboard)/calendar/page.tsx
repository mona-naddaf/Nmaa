import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth/require";
import { getCalendarData } from "@/lib/calendar/data";
import { CalendarView } from "@/components/calendar/CalendarView";

// Staff-only (the dashboard layout + proxy already require a staff session;
// parents and the public board live on their own cookies and routes).
export default async function CalendarPage() {
  const session = await requireSession();
  const data = await getCalendarData(session);
  if (!data) redirect("/students");

  const viewer =
    session.role === "admin"
      ? await prisma.admin.findUnique({ where: { id: session.adminId }, select: { gender: true } })
      : await prisma.teacher.findUnique({ where: { id: session.teacherId }, select: { gender: true } });

  return (
    <CalendarView
      enabledOccasions={data.enabledOccasions}
      adjustments={data.adjustments}
      events={data.events}
      canManage={data.canManage}
      isSupervisor={data.isSupervisor}
      viewerGender={viewer?.gender ?? null}
    />
  );
}
