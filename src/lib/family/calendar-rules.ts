// «تقويم العائلة» (step 6): who may do what in a family's shared calendar,
// the checks on what she types, the children's limits, the byline under each
// event and the dashboards' «القادم» line — pure, unit-tested in
// calendar-rules.test.ts. The actions (src/app/family/calendar-actions.ts)
// resolve the actor from her own session and apply these.

import { addDays, countdownLabel, isValidIso } from "@/lib/calendar/hijri";
import { activeOccasions, itemTitle, upcomingItems, type Adjustment, type CustomEvent, type Occasion } from "@/lib/calendar/occasions";

// ---------- access ----------

/** A member of the family: an adult (with or without edit rights) or one of its children. */
export type CalendarActor = { kind: "ADULT" | "CHILD"; id: string; canEdit: boolean };
export type CalendarAction = "view" | "create" | "edit" | "occasions" | "adjust";

/**
 * Everyone in the family sees the calendar and adds events; she edits and
 * deletes her own; an adult with edit rights (the founder always) edits and
 * deletes anyone's, and alone turns occasions on and shifts them for moon
 * sighting. A child never has edit rights, whatever is passed.
 */
export function decideFamilyCalendar(actor: CalendarActor | null, action: CalendarAction, event?: { createdById: string | null }): boolean {
  if (!actor) return false;
  const editor = actor.kind === "ADULT" && actor.canEdit;
  switch (action) {
    case "view":
    case "create":
      return true;
    case "edit":
      return editor || (!!event && event.createdById === actor.id);
    case "occasions":
    case "adjust":
      return editor;
  }
}

// ---------- input ----------

export const EVENT_TITLE_MAX = 80;
export const EVENT_DESCRIPTION_MAX = 500;
// dates: a year back, two years ahead (of the server's day, a day of slack each way)
export const EVENT_PAST_DAYS = 365;
export const EVENT_FUTURE_DAYS = 730;
// caps: future events in a family, events on one day
export const FAMILY_EVENTS_MAX = 500;
export const EVENTS_PER_DAY_MAX = 20;

export type FamilyEventInput = { title: string; date: string; description: string };
export type FamilyEventFields = { title: string; date: Date; description: string | null };

export function cleanFamilyEvent(input: FamilyEventInput, now: Date = new Date()): { error: string } | FamilyEventFields {
  const title = String(input?.title ?? "").trim();
  const description = String(input?.description ?? "").trim();
  const date = String(input?.date ?? "");
  if (!title) return { error: "يُرجى إدخال عنوان المناسبة" };
  if (title.length > EVENT_TITLE_MAX) return { error: `يُرجى ألّا يتجاوز العنوان ${EVENT_TITLE_MAX} حرفًا` };
  if (description.length > EVENT_DESCRIPTION_MAX) return { error: `يُرجى ألّا يتجاوز الوصف ${EVENT_DESCRIPTION_MAX} حرف` };
  if (!isValidIso(date)) return { error: "يُرجى اختيار تاريخ صحيح" };
  const today = now.toISOString().slice(0, 10);
  if (date < addDays(today, -EVENT_PAST_DAYS - 1) || date > addDays(today, EVENT_FUTURE_DAYS + 1)) {
    return { error: "يمكن اختيار تاريخ خلال سنة مضت أو سنتين قادمتين" };
  }
  return { title, date: new Date(`${date}T00:00:00Z`), description: description || null };
}

// ---------- a child's limits on adding events ----------

export const CHILD_EVENTS_PER_10_MIN = 10;
export const CHILD_EVENTS_PER_DAY = 30;
const TEN_MIN = 10 * 60 * 1000;
const DAY = 24 * 60 * 60 * 1000;
export const CHILD_EVENTS_TOO_MANY = "أُضيفت مناسبات كثيرة في وقت قصير — يُرجى المحاولة لاحقًا";

/** Her own events' creation times in the last day → whether she may add one more now. */
export function childMayAddEvent(createdAt: Date[], now: Date = new Date()): boolean {
  const t = now.getTime();
  const lastDay = createdAt.filter((d) => t - d.getTime() < DAY);
  const last10 = lastDay.filter((d) => t - d.getTime() < TEN_MIN);
  return last10.length < CHILD_EVENTS_PER_10_MIN && lastDay.length < CHILD_EVENTS_PER_DAY;
}

// ---------- who added it ----------

type G = "MALE" | "FEMALE";
export type EventAuthor = { id: string; name: string; gender: G };

/**
 * «أضافها أحمد» / «أضافتها ليلى»; on her own: «أضفتَها» / «أضفتِها»; someone
 * no longer in the family (left, or the account was deleted): «أضافها عضو سابق».
 */
export function eventByline(createdById: string | null, members: EventAuthor[], viewer: { id: string; gender: G }): string {
  if (createdById && createdById === viewer.id) return viewer.gender === "FEMALE" ? "أضفتِها" : "أضفتَها";
  const author = createdById ? members.find((m) => m.id === createdById) : undefined;
  if (!author) return "أضافها عضو سابق";
  return `${author.gender === "FEMALE" ? "أضافتها" : "أضافها"} ${author.name}`;
}

// ---------- the dashboards' «القادم» line ----------

export const NEXT_ITEM_DAYS = 30;

/**
 * The nearest upcoming item — a family event or an occasion shown in the
 * family calendar, whichever comes first (today included) — within the next
 * 30 days, or null.
 */
export function nextFamilyItem(
  today: string,
  enabledOccasions: Occasion[],
  adjustments: Adjustment[],
  events: CustomEvent[],
): { title: string; date: string; when: string } | null {
  const first = upcomingItems(today, activeOccasions(enabledOccasions), adjustments, events)[0];
  if (!first || first.date > addDays(today, NEXT_ITEM_DAYS)) return null;
  const days = Math.round((Date.parse(`${first.date}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / DAY);
  return { title: itemTitle(first), date: first.date, when: countdownLabel(days) };
}
