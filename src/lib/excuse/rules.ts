import { addDays } from "@/lib/tracker/rules";

// «أيام العذر»: the excuse of a girl or woman, for her «جدول المتابعة» (and,
// separately, a pause of her memorization). Pure and client-safe; the
// server enforces these rules, the UI only mirrors them. Days are
// "YYYY-MM-DD" (a course student's: the course's day; «رفيق الحفظ»: her own
// local day); minutes are minutes after midnight of that day.
//
// Rules:
//  - One press starts it and one ends it; it is never daily. Start and end
//    may be set to an earlier time, today or yesterday only.
//  - It ends by itself 15 days after it started (same minute).
//  - An item's own setting decides what the excuse does to it: NONE = it
//    counts as usual, SKIP = «لا يُحسب» (not due that day), ALT = «له بديل»
//    (its alternative shows in its place, ticked and scored as the item —
//    same id, same value). So only SKIP ever changes a score.
//  - Half days. When she presses «بدء العذر», the items she already ticked
//    (on any day from the start day to the day she presses) stay as they
//    were, and so does any item whose time on the start day is before the
//    start; untimed or later items switch. «انتهى العذر» is the mirror image:
//    what she already ticked, and items timed before the end, stay excused;
//    the rest return. The site never decides more than that for her.
//  - Both results are worked out once, on the server, when she presses
//    (boundaryKeys), and stored with the excuse, so a later change to an
//    item, its time or her city never rewrites the past.

export type ExcuseMode = "NONE" | "SKIP" | "ALT";
export type ItemState = "ORIGINAL" | "SKIP" | "ALT";

export const EXCUSE_LIMITS = {
  // it ends by itself this many days after it started
  maxDays: 15,
  altTitleMax: 60,
} as const;

export const isExcuseMode = (v: unknown): v is ExcuseMode => v === "NONE" || v === "SKIP" || v === "ALT";

/** A moment on her days: a day and a minute of it. */
export interface Moment {
  day: string;
  min: number;
}

export interface Excuse {
  start: Moment;
  // null while it lasts
  end: Moment | null;
  // «day:itemId» keys worked out when it started / ended (boundaryKeys)
  keepOriginal: string[];
  keepExcused: string[];
}

export const keyOf = (day: string, itemId: string) => `${day}:${itemId}`;

const cmp = (a: Moment, b: Moment) => (a.day < b.day ? -1 : a.day > b.day ? 1 : a.min - b.min);

/** When it ends by itself: 15 days after its start, same minute. */
export const autoEndOf = (start: Moment): Moment => ({ day: addDays(start.day, EXCUSE_LIMITS.maxDays), min: start.min });

/**
 * Its end as of now: the stored one, or the automatic one once that has
 * passed (auto: true; the server then closes it, the UI shows the notice
 * once). null: it still lasts.
 */
export function effectiveEnd(excuse: Pick<Excuse, "start" | "end">, now: Moment): { end: Moment; auto: boolean } | null {
  if (excuse.end) return { end: excuse.end, auto: false };
  const cap = autoEndOf(excuse.start);
  return cmp(now, cap) >= 0 ? { end: cap, auto: true } : null;
}

/** It lasts at this moment. */
export const isActive = (excuse: Pick<Excuse, "start" | "end">, now: Moment) => cmp(now, excuse.start) >= 0 && effectiveEnd(excuse, now) === null;

/**
 * What to keep as it was at a boundary (start: keepOriginal; end:
 * keepExcused): every item ticked on a day from the boundary's day to the
 * day she pressed, and every item of the boundary's day timed before the
 * boundary's minute. items: those of the boundary's day, with their time
 * that day (null = «بلا وقت», or an anchor with no place); ticks: day → ids.
 */
export function boundaryKeys(at: Moment, pressDay: string, items: { id: string; startMin: number | null }[], ticks: Record<string, string[]>): string[] {
  const keys = new Set<string>();
  for (const it of items) if (it.startMin !== null && it.startMin < at.min) keys.add(keyOf(at.day, it.id));
  for (let d = at.day; d <= pressDay; d = addDays(d, 1)) for (const id of ticks[d] ?? []) keys.add(keyOf(d, id));
  return [...keys];
}

/** Whether this excuse changes the item on that day (whatever the item's own setting). */
export function excusedOn(excuse: Excuse, itemId: string, day: string): boolean {
  if (day < excuse.start.day) return false;
  const key = keyOf(day, itemId);
  if (excuse.keepOriginal.includes(key)) return false;
  const end = excuse.end;
  if (!end || day < end.day) return true;
  // the end day, and the days up to the press: only what she kept
  return excuse.keepExcused.includes(key);
}

/** What the item is on that day: as usual, not counted, or its alternative. */
export function itemStateOn(item: { id: string; excuseMode: ExcuseMode }, day: string, excuses: Excuse[]): ItemState {
  if (item.excuseMode === "NONE") return "ORIGINAL";
  return excuses.some((e) => excusedOn(e, item.id, day)) ? item.excuseMode : "ORIGINAL";
}

/** For the scores: (item, day) pairs that aren't due («لا يُحسب» while excused). */
export function skippedBy(items: { id: string; excuseMode: ExcuseMode }[], excuses: Excuse[]): (itemId: string, day: string) => boolean {
  const skip = new Set(items.filter((i) => i.excuseMode === "SKIP").map((i) => i.id));
  if (!skip.size || !excuses.length) return () => false;
  return (itemId, day) => skip.has(itemId) && excuses.some((e) => excusedOn(e, itemId, day));
}

/** The days an excuse touched, up to today («يوم عذر» on the day tiles). */
export function excuseDays(excuses: Excuse[], today: string): Set<string> {
  const days = new Set<string>();
  for (const e of excuses) {
    const last = e.end ? e.end.day : today;
    for (let d = e.start.day; d <= last && d <= today; d = addDays(d, 1)) days.add(d);
  }
  return days;
}

// ---------- pausing memorization («إيقاف الحفظ أيضًا»; «رفيق الحفظ» and the family) ----------

/**
 * Her paused days: each stretch from its first day to its last (both
 * included, so a part day never breaks anything; a session on a paused day
 * still counts). to null: still paused, through today.
 */
export function pausedDays(pauses: { from: string; to: string | null }[], today: string): Set<string> {
  const days = new Set<string>();
  for (const p of pauses) for (let d = p.from; d <= (p.to ?? today) && d <= today; d = addDays(d, 1)) days.add(d);
  return days;
}

// ---------- validating a start or an end ----------

export type MomentError = "NO_TIME" | "FUTURE" | "TOO_EARLY" | "OVERLAP" | "BEFORE_START";

/** A submitted moment: today or yesterday, a whole minute of the day. null when malformed. */
export function parseMoment(input: unknown, today: string): Moment | null {
  if (!input || typeof input !== "object") return null;
  const { day, min } = input as { day?: unknown; min?: unknown };
  if (day !== today && day !== addDays(today, -1)) return null;
  if (!Number.isInteger(min) || (min as number) < 0 || (min as number) > 1439) return null;
  return { day: day as string, min: min as number };
}

/** A start: not in the future, not before yesterday, and after the end of her last excuse. */
export function checkStart(at: Moment | null, now: Moment, lastEnd: Moment | null): MomentError | null {
  if (!at) return "NO_TIME";
  if (at.day < addDays(now.day, -1)) return "TOO_EARLY";
  if (cmp(at, now) > 0) return "FUTURE";
  if (lastEnd && cmp(at, lastEnd) < 0) return "OVERLAP";
  return null;
}

/** An end: not in the future, not before yesterday, and after its start. */
export function checkEnd(at: Moment | null, now: Moment, start: Moment): MomentError | null {
  if (!at) return "NO_TIME";
  if (at.day < addDays(now.day, -1)) return "TOO_EARLY";
  if (cmp(at, now) > 0) return "FUTURE";
  if (cmp(at, start) <= 0) return "BEFORE_START";
  return null;
}

// ---------- an item's setting ----------

/** A submitted setting: the mode, and the alternative's cleaned title for ALT (else null). */
export function validateItemExcuse(
  mode: unknown,
  altRaw: unknown,
  you: "MALE" | "FEMALE" | null,
): { excuseMode: ExcuseMode; excuseAltTitle: string | null } | { error: string } {
  if (!isExcuseMode(mode)) return { error: "اختيار غير صحيح" };
  if (mode !== "ALT") return { excuseMode: mode, excuseAltTitle: null };
  const alt = (typeof altRaw === "string" ? altRaw : "").replace(/\s+/g, " ").trim();
  if (!alt) return { error: you === "MALE" ? "اكتب البديل أولًا" : "اكتبي البديل أولًا" };
  if (alt.length > EXCUSE_LIMITS.altTitleMax) return { error: `يُرجى ألّا يزيد البديل على ${EXCUSE_LIMITS.altTitleMax} حرفًا` };
  return { excuseMode: "ALT", excuseAltTitle: alt };
}
