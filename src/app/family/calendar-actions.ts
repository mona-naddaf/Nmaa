"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { familyCalendarActor, type CalendarSubject } from "@/lib/family/calendar";
import {
  CHILD_EVENTS_TOO_MANY,
  childMayAddEvent,
  cleanFamilyEvent,
  decideFamilyCalendar,
  EVENTS_PER_DAY_MAX,
  FAMILY_EVENTS_MAX,
  type FamilyEventFields,
  type FamilyEventInput,
} from "@/lib/family/calendar-rules";
import { addDays, toHijri } from "@/lib/calendar/hijri";
import { adjustableYears, isOccasion, isOptionalOccasion, MAX_ADJUSTMENT_DAYS, OPTIONAL_OCCASIONS } from "@/lib/calendar/occasions";

// «تقويم العائلة» (step 6): the same actions for the adults' page
// (/rafiq/family/[id]/calendar) and the children's (/family/calendar), bound
// to the family id by each page. Who may do what: decideFamilyCalendar
// (src/lib/family/calendar-rules.ts); the actor from her own session only.
// Each write's where holds the family (and, for someone who isn't an
// editor, her own id), so another family's event simply matches nothing.

export type FamilyCalendarResult = { error?: string };

const NOT_FOUND = "هذه المناسبة غير موجودة";
const EDITORS_ONLY = "هذا الإجراء متاح لمن يستطيع تعديل بيانات الأطفال";
const onlyOwn = (s: CalendarSubject) => `يمكن تعديل ما ${s.gender === "FEMALE" ? "أضفتِه" : "أضفتَه"} فقط`;

function refresh(familyId: string) {
  revalidatePath(`/rafiq/family/${familyId}`, "layout");
  revalidatePath("/family", "layout");
}

/** The family's caps: future events, and events on one day (leaving out the one being edited). */
async function capError(familyId: string, fields: FamilyEventFields, editingId?: string): Promise<string | null> {
  const yesterday = new Date(`${addDays(new Date().toISOString().slice(0, 10), -1)}T00:00:00Z`);
  const not = editingId ? { id: { not: editingId } } : {};
  const [future, sameDay] = await Promise.all([
    editingId ? 0 : prisma.familyEvent.count({ where: { familyId, date: { gte: yesterday } } }),
    prisma.familyEvent.count({ where: { familyId, date: fields.date, ...not } }),
  ]);
  if (future >= FAMILY_EVENTS_MAX) return `يمكن أن يضم تقويم العائلة ${FAMILY_EVENTS_MAX} مناسبة قادمة على الأكثر`;
  if (sameDay >= EVENTS_PER_DAY_MAX) return `يمكن إضافة ${EVENTS_PER_DAY_MAX} مناسبة في اليوم الواحد على الأكثر`;
  return null;
}

export async function createFamilyEventAction(familyId: string, input: FamilyEventInput): Promise<FamilyCalendarResult> {
  const s = await familyCalendarActor(familyId);
  if ("error" in s) return s;
  if (!decideFamilyCalendar(s.actor, "create")) return { error: EDITORS_ONLY };
  const fields = cleanFamilyEvent(input);
  if ("error" in fields) return fields;
  if (s.actor.kind === "CHILD") {
    const recent = await prisma.familyEvent.findMany({
      where: { createdById: s.actor.id, createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
      select: { createdAt: true },
    });
    if (!childMayAddEvent(recent.map((r) => r.createdAt))) return { error: CHILD_EVENTS_TOO_MANY };
  }
  const cap = await capError(s.familyId, fields);
  if (cap) return { error: cap };
  await prisma.familyEvent.create({ data: { familyId: s.familyId, createdById: s.actor.id, ...fields } });
  refresh(s.familyId);
  return {};
}

/** Her own event, or anyone's for an adult with edit rights. */
async function editable(s: CalendarSubject, id: unknown): Promise<{ error: string } | { id: string; where: object }> {
  const event = typeof id === "string" && id ? await prisma.familyEvent.findFirst({ where: { id, familyId: s.familyId }, select: { id: true, createdById: true } }) : null;
  if (!event) return { error: NOT_FOUND };
  if (!decideFamilyCalendar(s.actor, "edit", event)) return { error: onlyOwn(s) };
  // the same check again in the write itself
  const editor = s.actor.kind === "ADULT" && s.actor.canEdit;
  return { id: event.id, where: { id: event.id, familyId: s.familyId, ...(editor ? {} : { createdById: s.actor.id }) } };
}

export async function updateFamilyEventAction(familyId: string, id: string, input: FamilyEventInput): Promise<FamilyCalendarResult> {
  const s = await familyCalendarActor(familyId);
  if ("error" in s) return s;
  const target = await editable(s, id);
  if ("error" in target) return target;
  const fields = cleanFamilyEvent(input);
  if ("error" in fields) return fields;
  const cap = await capError(s.familyId, fields, target.id);
  if (cap) return { error: cap };
  const { count } = await prisma.familyEvent.updateMany({ where: target.where, data: fields });
  if (count === 0) return { error: NOT_FOUND };
  refresh(s.familyId);
  return {};
}

export async function deleteFamilyEventAction(familyId: string, id: string): Promise<FamilyCalendarResult> {
  const s = await familyCalendarActor(familyId);
  if ("error" in s) return s;
  const target = await editable(s, id);
  if ("error" in target) return target;
  const { count } = await prisma.familyEvent.deleteMany({ where: target.where });
  if (count === 0) return { error: NOT_FOUND };
  refresh(s.familyId);
  return {};
}

export async function setFamilyOccasionAction(familyId: string, occasion: string, enabled: boolean): Promise<FamilyCalendarResult> {
  const s = await familyCalendarActor(familyId);
  if ("error" in s) return s;
  if (!decideFamilyCalendar(s.actor, "occasions")) return { error: EDITORS_ONLY };
  if (!isOptionalOccasion(occasion)) return { error: "مناسبة غير معروفة" };
  const { enabledOccasions } = await prisma.family.findUniqueOrThrow({ where: { id: s.familyId }, select: { enabledOccasions: true } });
  const next = new Set(enabledOccasions);
  if (enabled === true) next.add(occasion);
  else next.delete(occasion);
  // keep catalog order, and only ever optional presets
  await prisma.family.update({ where: { id: s.familyId }, data: { enabledOccasions: OPTIONAL_OCCASIONS.filter((o) => next.has(o)) } });
  refresh(s.familyId);
  return {};
}

/** Shifts one year's occurrence of an occasion by ±1/±2 days for the whole family, or 0 to remove the shift. */
export async function setFamilyAdjustmentAction(familyId: string, occasion: string, hijriYear: number, offsetDays: number): Promise<FamilyCalendarResult> {
  const s = await familyCalendarActor(familyId);
  if ("error" in s) return s;
  if (!decideFamilyCalendar(s.actor, "adjust")) return { error: EDITORS_ONLY };
  if (!isOccasion(occasion)) return { error: "مناسبة غير معروفة" };
  if (!Number.isInteger(offsetDays) || Math.abs(offsetDays) > MAX_ADJUSTMENT_DAYS) {
    return { error: "يمكن تعديل الموعد بيوم أو يومين فقط" };
  }
  // her browser decides "today" and may be a day off the server's UTC day
  const utcToday = new Date().toISOString().slice(0, 10);
  const allowed = new Set([-1, 0, 1].flatMap((d) => adjustableYears(toHijri(addDays(utcToday, d)).year)));
  if (!allowed.has(hijriYear)) return { error: "يمكن تعديل الموعد الحالي والقادم فقط" };

  if (offsetDays === 0) {
    await prisma.familyCalendarAdjustment.deleteMany({ where: { familyId: s.familyId, occasion, hijriYear } });
  } else {
    await prisma.familyCalendarAdjustment.upsert({
      where: { familyId_occasion_hijriYear: { familyId: s.familyId, occasion, hijriYear } },
      update: { offsetDays },
      create: { familyId: s.familyId, occasion, hijriYear, offsetDays },
    });
  }
  refresh(s.familyId);
  return {};
}
