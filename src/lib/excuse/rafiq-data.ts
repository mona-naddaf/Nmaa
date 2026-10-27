import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { dateOnly, isoOf } from "@/lib/time/zone";
import { nowKey } from "@/lib/tracker/agenda";
import { addDays, isActiveOn, weekdayOf } from "@/lib/tracker/rules";
import { effectiveTiming, resolveTiming } from "@/lib/tracker/schedule";
import { prayerMinutes } from "@/lib/prayer/times";
import { rafiqPlace } from "@/lib/prayer/place-data";
import { excuseEnabled } from "./enabled";
import { adultExcuseApplies } from "./visibility";
import { boundaryKeys, checkEnd, checkStart, effectiveEnd, keyOf, type Excuse, type Moment, type MomentError } from "./rules";
import { excuseLens } from "./lens";
import { momentErrorText } from "./texts";

// «أيام العذر» in «رفيق الحفظ»: loading her excuses, and starting and ending
// one. Her days are her browser's (its time zone, sent with each action, as
// «المحصّلات» do), so "now" is worked out here from that zone, never taken
// from the browser. Only ever called for someone who may see the excuse
// (src/lib/excuse/visibility.ts); this step: a woman's own.

const ROW = { id: true, startDay: true, startMin: true, endDay: true, endMin: true, keepOriginal: true, keepExcused: true } as const;
type Row = Prisma.RafiqExcuseGetPayload<{ select: typeof ROW }>;

export const toExcuse = (r: Row): Excuse => ({
  start: { day: isoOf(r.startDay), min: r.startMin },
  end: r.endDay ? { day: isoOf(r.endDay), min: r.endMin ?? 0 } : null,
  keepOriginal: r.keepOriginal,
  keepExcused: r.keepExcused,
});

/** Her moment now, in her time zone. */
export function nowIn(tz: string): Moment {
  const [day, min] = nowKey(tz).split("|");
  return { day, min: Number(min) };
}

/**
 * Her own excuse in «رفيق الحفظ»: the feature on here and she a woman.
 * show: her excuses count in her views (her past ones too, after she turns
 * her switch off); on: her switch is on (the button and the item setting).
 */
export async function ownExcuse(userId: string): Promise<{ show: boolean; on: boolean }> {
  if (!excuseEnabled()) return { show: false, on: false };
  const u = await prisma.rafiqUser.findUnique({ where: { id: userId }, select: { kind: true, gender: true, excuseEnabled: true } });
  if (!u) return { show: false, on: false };
  const woman = adultExcuseApplies({ kind: u.kind, gender: u.gender, excuseEnabled: true });
  return { show: woman, on: woman && u.excuseEnabled };
}

/** Her excuses that reach fromDay or later (the open one included), oldest first. */
export async function loadExcuses(userId: string, fromDay: string): Promise<Excuse[]> {
  const rows = await prisma.rafiqExcuse.findMany({
    where: { userId, OR: [{ endDay: null }, { endDay: { gte: dateOnly(fromDay) } }] },
    orderBy: { startDay: "asc" },
    select: ROW,
  });
  return rows.map(toExcuse);
}

/**
 * What a boundary keeps as it was (boundaryKeys): her items of that day with
 * their time then (only with «الجدول اليومي» on: otherwise she never saw a
 * time), and her ticks from that day to today.
 */
async function keysAt(userId: string, at: Moment, today: string, tz: string): Promise<string[]> {
  const [user, items, ticks] = await Promise.all([
    prisma.rafiqUser.findUniqueOrThrow({ where: { id: userId }, select: { agendaEnabled: true } }),
    prisma.rafiqTrackerItem.findMany({
      where: { userId, OR: [{ archivedAt: null }, { archivedAt: { gte: dateOnly(addDays(at.day, -1)) } }] },
      select: { id: true, days: true, slots: { select: { weekdays: true, startMin: true, durationMin: true, anchor: true, anchorOffsetMin: true } } },
    }),
    prisma.rafiqTrackerCheck.findMany({ where: { userId, day: { gte: dateOnly(at.day), lte: dateOnly(today) } }, select: { itemId: true, day: true } }),
  ]);
  const place = user.agendaEnabled ? await rafiqPlace(userId) : null;
  const prayers = place ? prayerMinutes(place, at.day, tz) : null;
  const timed = items
    .filter((i) => isActiveOn(i.days, at.day))
    .map((i) => ({
      id: i.id,
      startMin: user.agendaEnabled ? (resolveTiming(effectiveTiming([], i.slots, weekdayOf(at.day)).timing, prayers)?.startMin ?? null) : null,
    }));
  const byDay: Record<string, string[]> = {};
  for (const c of ticks) (byDay[isoOf(c.day)] ??= []).push(c.itemId);
  return boundaryKeys(at, today, timed, byDay);
}

const openOf = (userId: string) => prisma.rafiqExcuse.findFirst({ where: { userId, endDay: null }, select: ROW });

async function close(userId: string, id: string, at: Moment, now: Moment, tz: string, by: { actor: "SELF" | "ADULT" | "AUTO"; adultId: string | null }) {
  const keepExcused = await keysAt(userId, at, now.day, tz);
  await prisma.rafiqExcuse.updateMany({
    where: { id, endDay: null },
    data: { endDay: dateOnly(at.day), endMin: at.min, keepExcused, endedBy: by.actor, endedById: by.adultId },
  });
}

/** An open excuse past its 15 days ends at its cap. true: it just did. */
export async function settleExpired(userId: string, now: Moment, tz: string): Promise<boolean> {
  const open = await openOf(userId);
  const eff = open && effectiveEnd(toExcuse(open), now);
  if (!open || !eff?.auto) return false;
  // nobody pressed: it ended at its cap, so only the cap day's own ticks
  // stay excused, never ticks of the days after it (however late this runs)
  await close(userId, open.id, eff.end, { day: eff.end.day, min: now.min }, tz, { actor: "AUTO", adultId: null });
  return true;
}

export type MomentInput = "NOW" | { day?: unknown; min?: unknown } | null | undefined;

/** The submitted moment (today or yesterday), or the reason it can't be used. */
function readMoment(input: MomentInput, now: Moment): Moment | null | "TOO_EARLY" {
  if (input === "NOW") return now;
  if (!input || typeof input !== "object") return null;
  const { day, min } = input;
  if (typeof day !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
  if (day < addDays(now.day, -1)) return "TOO_EARLY";
  if (day > now.day || !Number.isInteger(min) || (min as number) < 0 || (min as number) > 1439) return null;
  return { day, min: min as number };
}

type G = "MALE" | "FEMALE";
export type ExcuseResult = { error?: string; autoEnded?: boolean };

const errorOf = (e: MomentError, you: G, other: Moment | null, today: string) => ({ error: momentErrorText(e, you, other, today) });

/** «بدء العذر»: from now or an earlier moment (today or yesterday). you: who presses, for the wording. */
export async function startExcuse(userId: string, input: MomentInput, tz: string, by: { you: G; adultId: string | null }): Promise<ExcuseResult> {
  const now = nowIn(tz);
  const autoEnded = await settleExpired(userId, now, tz);
  if (await openOf(userId)) return { autoEnded };
  const read = readMoment(input, now);
  const at = read === "TOO_EARLY" ? null : read;
  const last = await prisma.rafiqExcuse.findFirst({ where: { userId, endDay: { not: null } }, orderBy: [{ endDay: "desc" }, { endMin: "desc" }], select: ROW });
  const lastEnd = last ? toExcuse(last).end : null;
  const problem = read === "TOO_EARLY" ? "TOO_EARLY" : checkStart(at, now, lastEnd);
  if (problem || !at) return errorOf(problem ?? "NO_TIME", by.you, lastEnd, now.day);
  try {
    await prisma.rafiqExcuse.create({
      data: {
        userId,
        startDay: dateOnly(at.day),
        startMin: at.min,
        keepOriginal: await keysAt(userId, at, now.day, tz),
        startedBy: by.adultId ? "ADULT" : "SELF",
        startedById: by.adultId,
      },
    });
  } catch (e) {
    // started meanwhile (another tab): already as she wants it
    if (!(e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002")) throw e;
  }
  return { autoEnded };
}

/** «انتهى العذر»: now or an earlier moment, after its start. */
export async function endExcuse(userId: string, input: MomentInput, tz: string, by: { you: G; adultId: string | null }): Promise<ExcuseResult> {
  const now = nowIn(tz);
  if (await settleExpired(userId, now, tz)) return { autoEnded: true };
  const open = await openOf(userId);
  // ended meanwhile: already as she wants it
  if (!open) return {};
  const start = toExcuse(open).start;
  const read = readMoment(input, now);
  const at = read === "TOO_EARLY" ? null : read;
  const problem = read === "TOO_EARLY" ? "TOO_EARLY" : checkEnd(at, now, start);
  if (problem || !at) return errorOf(problem ?? "NO_TIME", by.you, start, now.day);
  await close(userId, open.id, at, now, tz, { actor: by.adultId ? "ADULT" : "SELF", adultId: by.adultId });
  return {};
}

/** Turning the feature off ends an open excuse now (A4). */
export async function endOnSwitchOff(userId: string, tz: string, by: { adultId: string | null }): Promise<void> {
  const now = nowIn(tz);
  if (await settleExpired(userId, now, tz)) return;
  const open = await openOf(userId);
  if (!open) return;
  const start = toExcuse(open).start;
  // started this very minute: ends a minute later rather than before it began
  const later = start.min < 1439 ? { day: start.day, min: start.min + 1 } : { day: addDays(start.day, 1), min: 0 };
  const at = checkEnd(now, now, start) === "BEFORE_START" ? later : now;
  await close(userId, open.id, at, now, tz, { actor: by.adultId ? "ADULT" : "SELF", adultId: by.adultId });
}

/**
 * For viewers who may not see her excuse (her family's dashboard): per
 * woman, the «day:itemId» pairs not counted from fromDay to tomorrow (a day
 * of time-zone slack), so the scores leave them out quietly. Her own
 * moment isn't known here: the server's UTC one stands in (it only decides
 * whether an excuse past its 15 days has ended).
 */
export async function quietSkips(userIds: string[], fromDay: string): Promise<Record<string, string[]>> {
  if (!excuseEnabled() || userIds.length === 0) return {};
  const women = (await prisma.rafiqUser.findMany({ where: { id: { in: userIds }, kind: "ADULT", gender: "FEMALE" }, select: { id: true } })).map((u) => u.id);
  if (women.length === 0) return {};
  const [excuses, items] = await Promise.all([
    prisma.rafiqExcuse.findMany({
      where: { userId: { in: women }, OR: [{ endDay: null }, { endDay: { gte: dateOnly(fromDay) } }] },
      orderBy: { startDay: "asc" },
      select: { ...ROW, userId: true },
    }),
    prisma.rafiqTrackerItem.findMany({ where: { userId: { in: women }, excuseMode: "SKIP" }, select: { id: true, userId: true, excuseMode: true } }),
  ]);
  const now = nowIn("UTC");
  const out: Record<string, string[]> = {};
  for (const id of women) {
    const mine = excuses.filter((e) => e.userId === id).map(toExcuse);
    const skips = items.filter((i) => i.userId === id);
    if (mine.length === 0 || skips.length === 0) continue;
    const lens = excuseLens(skips, mine, now);
    const keys: string[] = [];
    for (let d = fromDay; d <= addDays(now.day, 1); d = addDays(d, 1)) for (const i of skips) if (lens.skipped(i.id, d)) keys.push(keyOf(d, i.id));
    if (keys.length) out[id] = keys;
  }
  return out;
}
