// «الجدول اليومي», phase 3: an item's timing may be a clock time or a prayer
// anchor («بعد الفجر», «قبل المغرب بـ 15 دقيقة»), and may differ by weekday.
// Pure and client-safe.
//
// Stored as rows (TrackerSlot, TrackerStudentSlot, RafiqTrackerSlot), each
// for a set of weekdays: the every-day row (127) and day-specific rows
// (disjoint masks) that override it on their days. On a given day: a
// day-specific row for that weekday wins, else the every-day row; a course
// student's own rows (if one applies) come before staff's. A row with no
// time is «بلا وقت». A prayer anchor is resolved each day from the place's
// prayer times, so the item moves with the seasons; without a place it
// can't be placed and shows «بلا وقت».

import { clockLabel, DURATION_MAX, DURATION_MIN, minutesLabel, validateTime, type AgendaTime } from "./agenda";
import { isPrayer, PRAYER_NAME, type Prayer } from "@/lib/prayer/times";

export const ALL_DAYS = 127;
export const OFFSET_MAX = 180;
const MAX_ROWS = 8;

export type Timing =
  | { kind: "CLOCK"; startMin: number; durationMin: number | null }
  | { kind: "PRAYER"; prayer: Prayer; offsetMin: number; durationMin: number | null }
  | null;

/** A stored row. anchor set: a prayer anchor (startMin unused); else startMin, or nothing: «بلا وقت». */
export interface SlotRow {
  weekdays: number;
  startMin: number | null;
  durationMin: number | null;
  anchor: Prayer | null;
  anchorOffsetMin: number | null;
}

export function rowTiming(r: SlotRow): Timing {
  if (r.anchor) return { kind: "PRAYER", prayer: r.anchor, offsetMin: r.anchorOffsetMin ?? 0, durationMin: r.durationMin };
  if (r.startMin !== null) return { kind: "CLOCK", startMin: r.startMin, durationMin: r.durationMin };
  return null;
}

export function timingRow(weekdays: number, t: Timing): SlotRow {
  if (!t) return { weekdays, startMin: null, durationMin: null, anchor: null, anchorOffsetMin: null };
  if (t.kind === "CLOCK") return { weekdays, startMin: t.startMin, durationMin: t.durationMin, anchor: null, anchorOffsetMin: null };
  return { weekdays, startMin: null, durationMin: t.durationMin, anchor: t.prayer, anchorOffsetMin: t.offsetMin };
}

const has = (mask: number, weekday: number) => (mask & (1 << weekday)) !== 0;

/** The row that applies on a weekday: a day-specific one, else the every-day one; undefined: none. */
export function rowFor(rows: SlotRow[], weekday: number): SlotRow | undefined {
  return rows.find((r) => r.weekdays !== ALL_DAYS && has(r.weekdays, weekday)) ?? rows.find((r) => r.weekdays === ALL_DAYS);
}

/** On a weekday: her own timing if one of her rows applies, else staff's. */
export function effectiveTiming(own: SlotRow[], staff: SlotRow[], weekday: number): { timing: Timing; own: boolean } {
  const mine = rowFor(own, weekday);
  if (mine) return { timing: rowTiming(mine), own: true };
  const theirs = rowFor(staff, weekday);
  return { timing: theirs ? rowTiming(theirs) : null, own: false };
}

/** A timing on a day: its clock time, or its prayer's time that day ± offset. null: «بلا وقت» (or no place for an anchor). */
export function resolveTiming(t: Timing, prayers: Record<Prayer, number> | null): AgendaTime | null {
  if (!t) return null;
  if (t.kind === "CLOCK") return { startMin: t.startMin, durationMin: t.durationMin };
  if (!prayers) return null;
  // an anchor before a prayer just after midnight can't start before the day does
  return { startMin: Math.max(0, prayers[t.prayer] + t.offsetMin), durationMin: t.durationMin };
}

function minutesAfterBi(n: number): string {
  if (n === 1) return "بدقيقة";
  if (n === 2) return "بدقيقتين";
  return n <= 10 ? `بـ ${n} دقائق` : `بـ ${n} دقيقة`;
}

/** «بعد الفجر», «بعد العصر بـ 20 دقيقة», «قبل المغرب بـ 15 دقيقة», or a clock time; «بلا وقت». */
export function timingLabel(t: Timing): string {
  if (!t) return "بلا وقت";
  if (t.kind === "CLOCK") return t.durationMin ? `${clockLabel(t.startMin)} – ${clockLabel(t.startMin + t.durationMin)}` : clockLabel(t.startMin);
  const name = PRAYER_NAME[t.prayer];
  const base = t.offsetMin < 0 ? `قبل ${name} ${minutesAfterBi(-t.offsetMin)}` : t.offsetMin > 0 ? `بعد ${name} ${minutesAfterBi(t.offsetMin)}` : `بعد ${name}`;
  return t.durationMin ? `${base} (${minutesLabel(t.durationMin)})` : base;
}

/** The label with today's actual time for an anchor: «بعد الفجر · 4:45 ص». */
export function timingLabelOn(t: Timing, resolved: AgendaTime | null): string {
  if (t?.kind === "PRAYER" && resolved) {
    const time = resolved.durationMin ? `${clockLabel(resolved.startMin)} – ${clockLabel(resolved.startMin + resolved.durationMin)}` : clockLabel(resolved.startMin);
    return `${timingLabel({ ...t, durationMin: null })} · ${time}`;
  }
  return timingLabel(t);
}

/** A schedule's summary for lists: the every-day timing, and whether some days differ. */
export function scheduleLabel(rows: SlotRow[]): string {
  const base = rows.find((r) => r.weekdays === ALL_DAYS);
  const label = timingLabel(base ? rowTiming(base) : null);
  return rows.some((r) => r.weekdays !== ALL_DAYS) ? `${label} · تختلف بعض الأيام` : label;
}

/** A submitted timing; anchors only where the place is known. "ERR" when invalid. */
export function validateTiming(input: unknown, allowAnchors: boolean): Timing | "ERR" {
  if (input === null) return null;
  if (!input || typeof input !== "object") return "ERR";
  const v = input as Record<string, unknown>;
  const dur = v.durationMin;
  const duration = dur === null || dur === undefined ? null : Number.isInteger(dur) && (dur as number) >= DURATION_MIN && (dur as number) <= DURATION_MAX ? (dur as number) : "ERR";
  if (duration === "ERR") return "ERR";
  if (v.kind === "CLOCK") {
    const t = validateTime({ startMin: v.startMin, durationMin: duration });
    return t ? { kind: "CLOCK", ...t } : "ERR";
  }
  if (v.kind === "PRAYER") {
    if (!allowAnchors || !isPrayer(v.prayer)) return "ERR";
    const off = v.offsetMin;
    if (!Number.isInteger(off) || Math.abs(off as number) > OFFSET_MAX) return "ERR";
    return { kind: "PRAYER", prayer: v.prayer, offsetMin: off as number, durationMin: duration };
  }
  return "ERR";
}

/**
 * A submitted schedule: [{ weekdays, timing }]. At most one every-day row;
 * the others for disjoint sets of days. null when invalid.
 */
export function validateSchedule(input: unknown, allowAnchors: boolean): SlotRow[] | null {
  if (!Array.isArray(input) || input.length > MAX_ROWS) return null;
  const rows: SlotRow[] = [];
  let used = 0;
  for (const r of input) {
    if (!r || typeof r !== "object") return null;
    const { weekdays, timing } = r as { weekdays?: unknown; timing?: unknown };
    if (!Number.isInteger(weekdays) || (weekdays as number) < 1 || (weekdays as number) > ALL_DAYS) return null;
    const t = validateTiming(timing ?? null, allowAnchors);
    if (t === "ERR") return null;
    if (weekdays === ALL_DAYS) {
      if (rows.some((x) => x.weekdays === ALL_DAYS)) return null;
    } else {
      if (used & (weekdays as number)) return null;
      used |= weekdays as number;
    }
    rows.push(timingRow(weekdays as number, t));
  }
  return rows;
}

const sameTiming = (a: Timing, b: Timing) => JSON.stringify(a) === JSON.stringify(b);

/**
 * The editor's model as rows: the every-day timing (undefined: no row) and
 * day overrides by weekday. Days with the same timing share a row; a day
 * that just repeats the every-day timing needs no row.
 */
export function scheduleRows(base: Timing | undefined, days: Partial<Record<number, Timing>>): { weekdays: number; timing: Timing }[] {
  const out: { weekdays: number; timing: Timing }[] = [];
  if (base !== undefined) out.push({ weekdays: ALL_DAYS, timing: base });
  for (const [w, t] of Object.entries(days)) {
    if (t === undefined || (base !== undefined && sameTiming(t, base))) continue;
    const row = out.find((r) => r.weekdays !== ALL_DAYS && sameTiming(r.timing, t));
    if (row) row.weekdays |= 1 << Number(w);
    else out.push({ weekdays: 1 << Number(w), timing: t });
  }
  return out;
}

/** Rows back into the editor's model. */
export function scheduleModel(rows: SlotRow[]): { base: Timing | undefined; days: Partial<Record<number, Timing>> } {
  const baseRow = rows.find((r) => r.weekdays === ALL_DAYS);
  const days: Partial<Record<number, Timing>> = {};
  for (const r of rows) if (r.weekdays !== ALL_DAYS) for (let w = 0; w < 7; w++) if (has(r.weekdays, w)) days[w] = rowTiming(r);
  return { base: baseRow ? rowTiming(baseRow) : undefined, days };
}

/** «نسخ إلى أيام أخرى»: these days take this timing. */
export function copyToDays(days: Partial<Record<number, Timing>>, timing: Timing, to: number[]): Partial<Record<number, Timing>> {
  const next = { ...days };
  for (const w of to) next[w] = timing;
  return next;
}
