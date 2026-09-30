import "server-only";
import { prisma } from "@/lib/db";
import type { Session } from "@/lib/auth/session";
import type { Adjustment, CustomEvent, Occasion } from "./occasions";

type EditPermission = "ADMIN_ONLY" | "ALL_TEACHERS";

// Who may add events and turn optional occasions on/off. Editing or deleting
// a specific event is narrower — see canEditEvent.
export function canManageCalendar(session: Session, permission: EditPermission): boolean {
  return session.role === "admin" || permission === "ALL_TEACHERS";
}

// The supervisor edits every event. A teacher (only while teachers may
// manage the calendar at all) edits just the events she created herself;
// createdByTeacherId is null for the supervisor's events, so those never
// match a teacher.
export function canEditEvent(
  session: Session,
  permission: EditPermission,
  createdByTeacherId: string | null,
): boolean {
  if (session.role === "admin") return true;
  return permission === "ALL_TEACHERS" && createdByTeacherId === session.teacherId;
}

export type CalendarData = {
  bannerEnabled: boolean;
  canManage: boolean;
  isSupervisor: boolean;
  enabledOccasions: Occasion[];
  adjustments: Adjustment[];
  events: CustomEvent[];
};

/** null when the course has the calendar turned off. */
export async function getCalendarData(session: Session): Promise<CalendarData | null> {
  const course = await prisma.course.findUniqueOrThrow({
    where: { id: session.courseId },
    select: {
      calendarEnabled: true,
      calendarBannerEnabled: true,
      calendarEditPermission: true,
      enabledOccasions: true,
    },
  });
  if (!course.calendarEnabled) return null;

  const [adjustments, events] = await Promise.all([
    prisma.calendarAdjustment.findMany({
      where: { courseId: session.courseId },
      select: { occasion: true, hijriYear: true, offsetDays: true },
    }),
    prisma.calendarEvent.findMany({
      where: { courseId: session.courseId },
      orderBy: { date: "asc" },
      select: { id: true, title: true, description: true, date: true, createdByTeacherId: true },
    }),
  ]);

  return {
    bannerEnabled: course.calendarBannerEnabled,
    canManage: canManageCalendar(session, course.calendarEditPermission),
    isSupervisor: session.role === "admin",
    enabledOccasions: course.enabledOccasions,
    adjustments,
    events: events.map((e) => ({
      id: e.id,
      title: e.title,
      description: e.description,
      date: e.date.toISOString().slice(0, 10),
      editable: canEditEvent(session, course.calendarEditPermission, e.createdByTeacherId),
    })),
  };
}
