import "server-only";
import { prisma } from "@/lib/db";
import { getRafiqUser } from "@/lib/rafiq/session";
import { familyEnabled } from "./enabled";
import { familyAccess, FAMILY_OFF, NOT_AVAILABLE, SIGNED_OUT } from "./data";
import { getFamilyChild } from "./child-session";
import { decideFamilyCalendar, eventByline, NEXT_ITEM_DAYS, type CalendarActor, type EventAuthor } from "./calendar-rules";
import type { CalendarWording } from "@/components/calendar/CalendarView";
import type { Adjustment, CustomEvent, Occasion } from "@/lib/calendar/occasions";

// «تقويم العائلة» (step 6): one shared calendar per family — its events, its
// optional occasions and its moon-sighting adjustments — separate from each
// adult's own Rafiq calendar. The actor always comes from her own session:
// an adult who belongs to the family, or one of its children (whose family
// is her session's, never a URL's).

type G = "MALE" | "FEMALE";
export type CalendarSubject = { actor: CalendarActor; familyId: string; gender: G };

export async function familyCalendarActor(familyId: unknown): Promise<CalendarSubject | { error: string }> {
  if (!familyEnabled()) return { error: FAMILY_OFF };
  if (await getRafiqUser()) {
    const access = await familyAccess(familyId);
    if ("error" in access) return access;
    return { actor: { kind: "ADULT", id: access.user.id, canEdit: access.canEditChildren }, familyId: access.family.id, gender: access.user.gender };
  }
  const child = await getFamilyChild();
  if (!child) return { error: SIGNED_OUT };
  if (child.familyId !== familyId) return { error: NOT_AVAILABLE };
  return { actor: { kind: "CHILD", id: child.id, canEdit: false }, familyId: child.familyId, gender: child.gender };
}

/** Everyone who can be named under an event: the family's adults and children now. */
async function familyAuthors(familyId: string): Promise<EventAuthor[]> {
  const [members, children] = await Promise.all([
    prisma.familyMember.findMany({ where: { familyId }, select: { user: { select: { id: true, name: true, gender: true } } } }),
    prisma.rafiqUser.findMany({ where: { familyId, kind: "CHILD" }, select: { id: true, name: true, gender: true } }),
  ]);
  return [...members.map((m) => m.user), ...children].map((p) => ({ id: p.id, name: p.name ?? "", gender: p.gender }));
}

export type FamilyCalendarData = {
  enabledOccasions: Occasion[];
  adjustments: Adjustment[];
  events: CustomEvent[];
};

const iso = (d: Date) => d.toISOString().slice(0, 10);

/** The whole calendar for one member: each event with whether she may change it and who added it. */
export async function familyCalendarData(s: CalendarSubject): Promise<FamilyCalendarData> {
  const [family, adjustments, events, authors] = await Promise.all([
    prisma.family.findUniqueOrThrow({ where: { id: s.familyId }, select: { enabledOccasions: true } }),
    prisma.familyCalendarAdjustment.findMany({ where: { familyId: s.familyId }, select: { occasion: true, hijriYear: true, offsetDays: true } }),
    prisma.familyEvent.findMany({
      where: { familyId: s.familyId },
      orderBy: { date: "asc" },
      select: { id: true, title: true, description: true, date: true, createdById: true },
    }),
    familyAuthors(s.familyId),
  ]);
  const viewer = { id: s.actor.id, gender: s.gender };
  return {
    enabledOccasions: family.enabledOccasions,
    adjustments,
    events: events.map((e) => ({
      id: e.id,
      title: e.title,
      description: e.description,
      date: iso(e.date),
      editable: decideFamilyCalendar(s.actor, "edit", e),
      byline: eventByline(e.createdById, authors, viewer),
    })),
  };
}

/**
 * What the dashboards' «القادم» line needs: the family's occasions and only
 * the events of the next 30 days (a day of time-zone slack each way). The
 * viewer's browser picks the nearest on her own day.
 */
export async function familyUpcoming(familyId: string): Promise<FamilyCalendarData> {
  const today = iso(new Date());
  const from = new Date(`${today}T00:00:00Z`);
  from.setUTCDate(from.getUTCDate() - 1);
  const to = new Date(`${today}T00:00:00Z`);
  to.setUTCDate(to.getUTCDate() + NEXT_ITEM_DAYS + 1);
  const [family, adjustments, events] = await Promise.all([
    prisma.family.findUniqueOrThrow({ where: { id: familyId }, select: { enabledOccasions: true } }),
    prisma.familyCalendarAdjustment.findMany({ where: { familyId }, select: { occasion: true, hijriYear: true, offsetDays: true } }),
    prisma.familyEvent.findMany({ where: { familyId, date: { gte: from, lte: to } }, orderBy: { date: "asc" }, select: { id: true, title: true, date: true } }),
  ]);
  return {
    enabledOccasions: family.enabledOccasions,
    adjustments,
    events: events.map((e, n) => ({ id: `u${n}`, title: e.title, description: null, date: iso(e.date), editable: false })),
  };
}

/** The family calendar's wording (neutral; the pages add a gendered intro). */
export function familyCalendarWording(editor: boolean): CalendarWording {
  return {
    eventLegend: "مناسبة عائلية",
    addEventOnDay: "+ إضافة مناسبة عائلية في هذا اليوم",
    addEvent: "+ إضافة مناسبة عائلية",
    newEvent: "مناسبة عائلية جديدة",
    editEvent: "تعديل المناسبة",
    confirmDeleteEvent: "حذف هذه المناسبة نهائيًا؟",
    emptyDay: "لا توجد مناسبات في هذا اليوم.",
    optionalIntro: "تظهر المناسبات الأساسية (رمضان، والعيدان، ويوم عرفة) دائمًا. ويمكن إضافة ما يلي إلى تقويم العائلة:",
    pastTitle: "المناسبات العائلية السابقة",
    pastEmpty: "لا توجد مناسبات عائلية سابقة.",
    adjustNote: editor ? " يمكن تعديل موعد أي مناسبة للعام الحالي والقادم لكل العائلة من قائمة القادم أو من يومها في التقويم." : "",
    titleRequired: "يُرجى إدخال عنوان المناسبة",
  };
}
