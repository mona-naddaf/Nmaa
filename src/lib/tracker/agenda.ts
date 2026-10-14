// The daily agenda of «جدول المتابعة» (phase 1: clock times). Pure and
// client-safe: no DB, no server-only imports; the server actions enforce
// these rules and the UI only mirrors them.
//
// An item may have a time on a day: a start (minutes after midnight, in the
// course's time zone — or the browser's in «رفيق الحفظ») and an optional
// duration. An item without one sits in «بلا وقت». An item belongs to the
// day it starts; one that runs past midnight ends after 1440. Overlapping
// items are allowed and shown side by side.
//
// Ticking is unchanged (TrackerCheck / RafiqTrackerCheck per day): times and
// order never touch scores.

import { zoneDayOf, zoneOffsetMinutes } from "@/lib/time/zone";

export const DAY_MINUTES = 24 * 60;
export const DURATION_MIN = 5;
export const DURATION_MAX = 12 * 60;
// items shown in the «الآن» card without a duration count as this long
export const POINT_MINUTES = 15;
export const ORDER_MAX_ITEMS = 120;

/** A time on a day: start (0–1439) and optional duration (5–720 minutes). */
export type AgendaTime = { startMin: number; durationMin: number | null };

/** null when not a valid time; a duration of null is allowed. */
export function validateTime(input: unknown): AgendaTime | null {
  if (!input || typeof input !== "object") return null;
  const { startMin, durationMin } = input as { startMin?: unknown; durationMin?: unknown };
  if (!Number.isInteger(startMin) || (startMin as number) < 0 || (startMin as number) >= DAY_MINUTES) return null;
  if (durationMin === null || durationMin === undefined) return { startMin: startMin as number, durationMin: null };
  if (!Number.isInteger(durationMin) || (durationMin as number) < DURATION_MIN || (durationMin as number) > DURATION_MAX) return null;
  return { startMin: startMin as number, durationMin: durationMin as number };
}

/** "HH:MM" (an <input type="time"> value) → minutes, or null. */
export function parseClock(value: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  return h < 24 && min < 60 ? h * 60 + min : null;
}

/** minutes → "HH:MM" (for an <input type="time">); wraps past midnight. */
export function clockValue(min: number): string {
  const m = ((min % DAY_MINUTES) + DAY_MINUTES) % DAY_MINUTES;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

/** Start and end as the two <input type="time"> values → a time (an end before the start runs past midnight). */
export function timeFromInputs(start: string, end: string): AgendaTime | { error: string } {
  const s = parseClock(start);
  if (s === null) return { error: "يُرجى اختيار وقت البداية" };
  if (!end.trim()) return { startMin: s, durationMin: null };
  const e = parseClock(end);
  if (e === null) return { error: "وقت النهاية غير صحيح" };
  let duration = e - s;
  if (duration <= 0) duration += DAY_MINUTES;
  if (duration < DURATION_MIN) return { error: `يُرجى أن تكون المدة ${DURATION_MIN} دقائق على الأقل` };
  if (duration > DURATION_MAX) return { error: "يُرجى ألّا تزيد المدة على اثنتي عشرة ساعة" };
  return { startMin: s, durationMin: duration };
}

/** A new start for the inputs: the end moves with it, keeping the duration (no end: none). */
export function shiftEnd(oldStart: string, oldEnd: string, newStart: string): string {
  const s0 = parseClock(oldStart);
  const e0 = parseClock(oldEnd);
  const s1 = parseClock(newStart);
  if (s0 === null || e0 === null || s1 === null) return oldEnd;
  let duration = e0 - s0;
  if (duration <= 0) duration += DAY_MINUTES;
  return clockValue(s1 + duration);
}

/** "7:30 ص" / "12:05 م" (12-hour, Latin digits like the rest of the site). */
export function clockLabel(min: number): string {
  const m = ((min % DAY_MINUTES) + DAY_MINUTES) % DAY_MINUTES;
  const h = Math.floor(m / 60);
  const h12 = h % 12 === 0 ? 12 : h % 12;
  // a no-break space keeps «ص/م» with its time when a label wraps
  return `${h12}:${String(m % 60).padStart(2, "0")} ${h < 12 ? "ص" : "م"}`;
}

/** "7:30 ص – 8:00 ص", or just the start. */
export function timeLabel(t: AgendaTime): string {
  return t.durationMin ? `${clockLabel(t.startMin)} – ${clockLabel(t.startMin + t.durationMin)}` : clockLabel(t.startMin);
}

/** «5 دقائق» / «ساعة» / «ساعة و20 دقيقة» — a span of minutes in words. */
export function minutesLabel(n: number): string {
  const mins = (k: number) => (k === 1 ? "دقيقة" : k === 2 ? "دقيقتان" : k <= 10 ? `${k} دقائق` : `${k} دقيقة`);
  const hours = (k: number) => (k === 1 ? "ساعة" : k === 2 ? "ساعتان" : k <= 10 ? `${k} ساعات` : `${k} ساعة`);
  if (n < 60) return mins(n);
  const h = Math.floor(n / 60);
  const m = n % 60;
  return m === 0 ? hours(h) : `${hours(h)} و${mins(m)}`;
}

/** Minutes since midnight now: in the course's zone, or (tz null: «رفيق الحفظ») the browser's. */
export function minuteOfDay(tz: string | null, now: Date = new Date()): number {
  if (!tz) return now.getHours() * 60 + now.getMinutes();
  const local = new Date(now.getTime() + zoneOffsetMinutes(tz, now) * 60000);
  return local.getUTCHours() * 60 + local.getUTCMinutes();
}

/** "YYYY-MM-DD|minute" now, for a store snapshot (tz null: the browser's). */
export function nowKey(tz: string | null, now: Date = new Date()): string {
  const day = tz
    ? zoneDayOf(tz, now)
    : `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  return `${day}|${minuteOfDay(tz, now)}`;
}

// ---------- order ----------

export interface Orderable {
  id: string;
  // the template order, 1, 2, …; 0 = not placed yet (after the placed ones)
  sortOrder: number;
  createdAt: string; // ISO
  // her own position (a course student's personal order), if she set one
  position?: number | null;
}

const LAST = Number.MAX_SAFE_INTEGER;
/** An item's place in the template order: 1, 2, … — or last when it has none yet (0). */
export const placeOf = (sortOrder: number) => (sortOrder > 0 ? sortOrder : LAST);

/**
 * Her personal order first (if any), then the template order, then creation
 * — so an item nobody has placed yet (a new one) comes after the placed
 * ones, and a tracker nobody ever reordered keeps its creation order.
 */
export function byAgendaOrder<T extends Orderable>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const pa = a.position ?? LAST;
    const pb = b.position ?? LAST;
    return pa - pb || placeOf(a.sortOrder) - placeOf(b.sortOrder) || a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id);
  });
}

/** The list with one id moved by delta (▲ −1 / ▼ +1); unchanged at the edges. */
export function moveId(ids: string[], id: string, delta: number): string[] {
  const i = ids.indexOf(id);
  const j = i + delta;
  if (i < 0 || j < 0 || j >= ids.length) return ids;
  const next = [...ids];
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}

/** A submitted order: distinct ids, all from `allowed`, at most ORDER_MAX_ITEMS. */
export function validateOrder(input: unknown, allowed: Set<string>): string[] | null {
  if (!Array.isArray(input) || input.length === 0 || input.length > ORDER_MAX_ITEMS) return null;
  const ids = input.map(String);
  if (new Set(ids).size !== ids.length || ids.some((id) => !allowed.has(id))) return null;
  return ids;
}

// ---------- timeline ----------

export interface Timed {
  id: string;
  time: AgendaTime;
}

const endOf = (t: AgendaTime) => t.startMin + (t.durationMin ?? POINT_MINUTES);

/**
 * Side-by-side lanes for overlapping items: each gets a lane and the number
 * of lanes in its overlapping cluster (its width is 1/lanes).
 */
export function layoutLanes<T extends Timed>(items: T[]): { item: T; lane: number; lanes: number }[] {
  const sorted = [...items].sort((a, b) => a.time.startMin - b.time.startMin || endOf(b.time) - endOf(a.time));
  const out: { item: T; lane: number; lanes: number }[] = [];
  let cluster: { item: T; lane: number; lanes: number }[] = [];
  let laneEnds: number[] = [];
  let clusterEnd = -1;
  const close = () => {
    for (const c of cluster) c.lanes = laneEnds.length;
    out.push(...cluster);
    cluster = [];
    laneEnds = [];
  };
  for (const item of sorted) {
    if (item.time.startMin >= clusterEnd && cluster.length) close();
    let lane = laneEnds.findIndex((end) => end <= item.time.startMin);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(0);
    }
    laneEnds[lane] = endOf(item.time);
    clusterEnd = Math.max(clusterEnd, endOf(item.time));
    cluster.push({ item, lane, lanes: 0 });
  }
  if (cluster.length) close();
  return out;
}

/** The hours the timeline spans: from the earliest start to the latest end (past midnight when an item runs over). */
export function timelineRange(items: Timed[], nowMin: number | null): { fromMin: number; toMin: number } {
  const starts = items.map((i) => i.time.startMin);
  const ends = items.map((i) => endOf(i.time));
  if (nowMin !== null) {
    starts.push(nowMin);
    ends.push(nowMin);
  }
  const from = Math.max(0, Math.floor(Math.min(...starts) / 60) * 60);
  const to = Math.max(from + 60, Math.ceil(Math.max(...ends) / 60) * 60);
  return { fromMin: from, toMin: to };
}

/** A stretch of the timeline: drawn to scale, or (a long empty gap) folded into a short band. */
export type TimelineSegment = { fromMin: number; toMin: number; folded: boolean };

// empty gaps longer than this fold into a band; busy times keep this margin
export const FOLD_AFTER_MIN = 120;
const BUSY_MARGIN = 30;

/**
 * The timeline as segments: busy hours (items, the «now» line) to scale,
 * long empty gaps between them folded — so a day with a dawn item and a
 * night item doesn't become a long empty scroll on a phone.
 */
export function timelineSegments(items: Timed[], nowMin: number | null): TimelineSegment[] {
  const { fromMin, toMin } = timelineRange(items, nowMin);
  const busy = items.map((i) => [i.time.startMin - BUSY_MARGIN, endOf(i.time) + BUSY_MARGIN]);
  if (nowMin !== null) busy.push([nowMin - BUSY_MARGIN, nowMin + BUSY_MARGIN]);
  busy.sort((a, b) => a[0] - b[0]);
  const merged: number[][] = [];
  for (const [s, e] of busy) {
    const last = merged[merged.length - 1];
    if (last && s <= last[1]) last[1] = Math.max(last[1], e);
    else merged.push([s, e]);
  }
  // snap to whole hours, so hour lines and labels stay on the hour
  const snapped = merged.map(([s, e]) => [Math.max(fromMin, Math.floor(s / 60) * 60), Math.min(toMin, Math.ceil(e / 60) * 60)]);
  const out: TimelineSegment[] = [];
  let cursor = fromMin;
  for (const [s, e] of snapped) {
    if (s - cursor > FOLD_AFTER_MIN) {
      out.push({ fromMin: cursor, toMin: s, folded: true });
    } else if (s > cursor) {
      out.push({ fromMin: cursor, toMin: s, folded: false });
    }
    const start = Math.max(cursor, s);
    if (e > start) out.push({ fromMin: start, toMin: e, folded: false });
    cursor = Math.max(cursor, e);
  }
  if (toMin > cursor) out.push({ fromMin: cursor, toMin, folded: toMin - cursor > FOLD_AFTER_MIN });
  // neighbouring to-scale pieces join up
  return out.reduce<TimelineSegment[]>((acc, seg) => {
    const last = acc[acc.length - 1];
    if (last && !last.folded && !seg.folded && last.toMin === seg.fromMin) last.toMin = seg.toMin;
    else acc.push({ ...seg });
    return acc;
  }, []);
}

/** Pixel position of a minute on the folded timeline (pxPerMin to scale; a folded gap takes foldPx). */
export function timelineY(segments: TimelineSegment[], min: number, pxPerMin: number, foldPx: number): number {
  let y = 0;
  for (const seg of segments) {
    const h = seg.folded ? foldPx : (seg.toMin - seg.fromMin) * pxPerMin;
    if (min <= seg.toMin) {
      const part = Math.max(0, min - seg.fromMin) / (seg.toMin - seg.fromMin || 1);
      return y + h * part;
    }
    y += h;
  }
  return y;
}

/** What a card needs on the timeline: its minutes (end = start + duration, or POINT_MINUTES) and its rendered height. */
export type CardNeed = { startMin: number; endMin: number; minPx: number };

/** The end a card occupies on the timeline. */
export const cardEnd = (t: AgendaTime) => endOf(t);

/**
 * The timeline's vertical scale: to scale (pxPerMin) or folded, as
 * timelineSegments says, but stretched locally wherever a card needs more
 * room than its minutes give it (a 5-minute item still gets a readable
 * card). Every card's box is then exactly [y(start), y(end)], so cards only
 * meet when their times truly overlap (those go side by side), and the
 * «now» line — placed with the same scale — stays accurate.
 */
export function timelineScale(segments: TimelineSegment[], cards: CardNeed[], pxPerMin: number, foldPx: number): (min: number) => number {
  const from = segments[0].fromMin;
  const to = segments[segments.length - 1].toMin;
  const clamp = (m: number) => Math.min(to, Math.max(from, m));
  const points = [...new Set([...segments.flatMap((s) => [s.fromMin, s.toMin]), ...cards.flatMap((c) => [clamp(c.startMin), clamp(c.endMin)])])].sort((a, b) => a - b);
  // the pieces between consecutive points, with their height
  const pieces = points.slice(0, -1).map((p, i) => {
    const q = points[i + 1];
    const seg = segments.find((s) => p >= s.fromMin && q <= s.toMin)!;
    const h = seg.folded ? (foldPx * (q - p)) / (seg.toMin - seg.fromMin) : (q - p) * pxPerMin;
    return { from: p, to: q, h };
  });
  // stretch: a card whose minutes are too short for it grows its own pieces
  // (only ever growing, so a card already satisfied stays satisfied)
  for (const c of cards) {
    const s = clamp(c.startMin);
    const e = clamp(c.endMin);
    const inside = pieces.filter((p) => p.from >= s && p.to <= e);
    const span = inside.reduce((n, p) => n + p.h, 0);
    if (span > 0 && span < c.minPx) for (const p of inside) p.h *= c.minPx / span;
  }
  return (min: number) => {
    let y = 0;
    for (const p of pieces) {
      if (min <= p.to) return y + (p.h * Math.max(0, min - p.from)) / (p.to - p.from || 1);
      y += p.h;
    }
    return y;
  };
}

/**
 * The «الآن» card: what's running now (an item without a duration counts
 * for POINT_MINUTES), how long is left, and the next one to start. now: the
 * minute of today; yesterday's items that ran past midnight are passed with
 * their start shifted by −1440.
 */
export function nowAndNext<T extends Timed>(items: T[], nowMin: number): { current: T[]; leftMin: number | null; next: T | null; inMin: number | null } {
  const current = items
    .filter((i) => i.time.startMin <= nowMin && nowMin < endOf(i.time))
    .sort((a, b) => endOf(a.time) - endOf(b.time));
  const upcoming = items.filter((i) => i.time.startMin > nowMin).sort((a, b) => a.time.startMin - b.time.startMin);
  const next = upcoming[0] ?? null;
  return {
    current,
    leftMin: current.length ? endOf(current[0].time) - nowMin : null,
    next,
    inMin: next ? next.time.startMin - nowMin : null,
  };
}
