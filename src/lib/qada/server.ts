import "server-only";
import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getRafiqUser } from "@/lib/rafiq/session";
import { addedBy, resolveSubject, type Subject } from "@/lib/rafiq/subject";
import { dateOnly, isoOf, safeTimeZone, zoneToday } from "@/lib/time/zone";
import { addDays, daysBetween, isValidIso } from "@/lib/calendar/hijri";
import { ownExcuse } from "@/lib/excuse/rafiq-data";
import { familyExcuseAllowed, viewerOverrides } from "@/lib/excuse/family-data";
import { familySees, familyViewerChecks } from "@/lib/excuse/visibility";
import { autoEndOf } from "@/lib/excuse/rules";
import { qadaAllowed } from "./enabled";
import { qadaAccess, type QadaAccess, type QadaViewer } from "./visibility";
import { KINDS, LIMITS, PRAYERS, isQadaKind, type PrayerKind, type QadaKind, type QadaTrack } from "./kinds";
import { totalsOf, type CountRow, type KindTotal, type TrackTotal } from "./totals";
import { estimate as runEstimate, parseEstimate, parsePreview, type EstimateInput } from "./estimate";
import { blockedFastDays } from "./fasting-days";
import { fastPlan, prayerPlan, type DayRow, type FastPlan, type Goal, type GoalMode, type PrayerPlan } from "./plan";
import { nextMilestone, type Milestone } from "./milestones";
import type { ExcuseSpan } from "./available";
import { ERR, QADA_DELETE_WORD } from "./texts";

// «القضاء» on the server: who may see and change whose qada (qadaGate), what
// the card gets (loadView — cut to what the viewer may see, so nothing else
// ever reaches her browser), and the writes. Every action starts with the
// gate, which decides from the database: the session, the family, the
// switches, QADA_EMAILS and the girl's «من يرى…» list.

export type Fail = { error: string };
const NOT_AVAILABLE: Fail = { error: ERR.notAvailable };

export type QadaGate = {
  subject: Subject;
  viewer: QadaViewer;
  access: QadaAccess;
  // the child's family (null: an adult's own)
  familyId: string | null;
  // the one looking, for the wording
  you: "MALE" | "FEMALE";
};

/** May the signed-in person see (need "view") or change (need "record") this subject's qada? */
export async function qadaGate(subjectId: unknown, need: "view" | "record"): Promise<QadaGate | Fail> {
  const s = await resolveSubject(subjectId, need);
  if ("error" in s) return s;
  if (s.kind === "ADULT") {
    const me = await getRafiqUser();
    if (!me || me.id !== s.id || !qadaAllowed(me.email)) return NOT_AVAILABLE;
    const row = await prisma.rafiqUser.findUnique({ where: { id: me.id }, select: { qadaEnabled: true } });
    if (!row?.qadaEnabled) return NOT_AVAILABLE;
    const access = qadaAccess("self", s, false);
    return access ? { subject: s, viewer: "self", access, familyId: null, you: s.gender } : NOT_AVAILABLE;
  }
  // a child's pages: the founder's email, her switch, and the adult's rights
  const child = await prisma.rafiqUser.findUnique({
    where: { id: s.id },
    select: {
      qadaEnabled: true,
      familyId: true,
      family: { select: { founderId: true, founder: { select: { email: true } }, members: { where: { userId: s.actorId }, select: { canEditChildren: true } } } },
    },
  });
  if (!child?.qadaEnabled || !child.familyId || !qadaAllowed(child.family?.founder.email)) return NOT_AVAILABLE;
  if (s.actorKind === "CHILD") {
    const access = qadaAccess("child", s, false);
    return access ? { subject: s, viewer: "child", access, familyId: child.familyId, you: s.gender } : NOT_AVAILABLE;
  }
  const canEdit = child.family?.founderId === s.actorId || child.family?.members[0]?.canEditChildren === true;
  const viewer: QadaViewer = canEdit ? "adult-edit" : "adult-view";
  const actor = await prisma.rafiqUser.findUniqueOrThrow({ where: { id: s.actorId }, select: { gender: true } });
  // her «من يرى…» list: rows, or else women yes and men no — whether «أيام العذر» is on or not
  const inList =
    s.gender === "FEMALE" && familySees({ kind: "ADULT", id: s.actorId, gender: actor.gender }, { id: s.id, gender: "FEMALE", excuseEnabled: true }, await viewerOverrides(s.id));
  const access = qadaAccess(viewer, s, inList);
  return access ? { subject: s, viewer, access, familyId: child.familyId, you: actor.gender } : NOT_AVAILABLE;
}

/** The kinds this viewer may see and change. */
export const visibleKinds = (a: QadaAccess): QadaKind[] => (a.fasting ? [...KINDS] : [...PRAYERS]);

/** Where «القضاء» reaches a family at all (the founder's email): for the child's switch. */
export async function familyQadaAllowed(familyId: string): Promise<boolean> {
  if (!process.env.QADA_EMAILS?.trim()) return false;
  const f = await prisma.family.findUnique({ where: { id: familyId }, select: { founder: { select: { email: true } } } });
  return !!f && qadaAllowed(f.founder.email);
}

// ---------- what the card gets ----------

export type LogLine = {
  // the batch's id, or the entry's own
  id: string;
  action: "OWED" | "MADE_UP";
  source: "MANUAL" | "ESTIMATE" | "FULL_DAY" | "TRACKER" | "RAMADAN_EXCUSE";
  parts: { kind: QadaKind; count: number }[];
  // only for a viewer who may see dates
  day?: string | null;
  createdAt?: string;
  // who made it, when it's someone else than the one whose page it is (null: an adult whose account is gone)
  by?: string | null;
};

export type GoalView = { mode: GoalMode; deadline: string | null; pace: number | null };

export type QadaView = {
  today: string;
  access: QadaAccess;
  // the one looking; on an adult's view of a child, the child
  you: "MALE" | "FEMALE";
  who: { name: string; gender: "MALE" | "FEMALE" } | null;
  kinds: QadaKind[];
  totals: Partial<Record<QadaKind, KindTotal>> & { prayers: TrackTotal; fast?: TrackTotal };
  log: LogLine[];
  // only with access.plan
  plan?: {
    prayers: PrayerPlan;
    fast: FastPlan | null;
    goals: { prayers: GoalView; fast: GoalView | null };
    // her average (excuse-aware only)
    avg: number | null;
    // the estimate's last answers (to reopen it filled in)
    estimate: EstimateInput | null;
  };
  // the owner's milestones still to show
  milestones?: { track: QadaTrack; level: Milestone }[];
};

const goalOf = (p: PlanRow | null, t: QadaTrack): Goal => {
  if (!p) return { mode: "NONE", deadline: null, pace: null, from: null, baseline: null };
  const day = (d: Date | null) => (d ? isoOf(d) : null);
  return t === "prayers"
    ? { mode: p.prayerMode, deadline: day(p.prayerDeadline), pace: p.prayerPace, from: day(p.prayerFrom), baseline: p.prayerBaseline }
    : { mode: p.fastMode, deadline: day(p.fastDeadline), pace: p.fastPace, from: day(p.fastFrom), baseline: p.fastBaseline };
};

type PlanRow = Prisma.RafiqQadaPlanGetPayload<object>;

/** Her excuses for the plan: recorded ones (null: she doesn't record them), and whether one is open now. */
async function excuseFacts(g: QadaGate, today: string): Promise<{ spans: ExcuseSpan[] | null; now: boolean }> {
  const s = g.subject;
  const records = s.kind === "ADULT" ? (await ownExcuse(s.id)).show : !!g.familyId && (await familyExcuseAllowed(g.familyId));
  if (!records) return { spans: null, now: false };
  const rows = await prisma.rafiqExcuse.findMany({
    // all of hers (a few a month): the plan reads those since its goals were set
    where: { userId: s.id },
    select: { startDay: true, startMin: true, endDay: true },
  });
  let now = false;
  const spans = rows.map((r) => {
    const start = isoOf(r.startDay);
    // an open one ends by itself after 15 days
    const end = r.endDay ? isoOf(r.endDay) : autoEndOf({ day: start, min: r.startMin }).day;
    if (!r.endDay && daysBetween(today, end) >= 0 && daysBetween(start, today) >= 0) now = true;
    return { start, end: r.endDay || daysBetween(today, end) < 0 ? end : null };
  });
  return { spans, now };
}

async function adjustmentsFor(g: QadaGate) {
  return g.familyId
    ? prisma.familyCalendarAdjustment.findMany({ where: { familyId: g.familyId }, select: { occasion: true, hijriYear: true, offsetDays: true } })
    : prisma.rafiqCalendarAdjustment.findMany({ where: { userId: g.subject.id }, select: { occasion: true, hijriYear: true, offsetDays: true } });
}

// how far ahead the days left out are worked out (a pace's finish date)
const BLOCKED_YEARS = 15;

export async function loadView(g: QadaGate, zone: unknown): Promise<QadaView> {
  const today = zoneToday(safeTimeZone(typeof zone === "string" ? zone : null));
  const kinds = visibleKinds(g.access);
  const userId = g.subject.id;
  // one round of queries: the excuses and the calendar shifts too, when the plan needs them
  const [sums, todays, planRow, entries, names, ex, adjustments] = await Promise.all([
    prisma.rafiqQadaEntry.groupBy({ by: ["kind", "action"], where: { userId, kind: { in: kinds } }, _sum: { count: true } }),
    prisma.rafiqQadaEntry.groupBy({ by: ["kind"], where: { userId, kind: { in: kinds }, action: "MADE_UP", day: dateOnly(today) }, _sum: { count: true } }),
    prisma.rafiqQadaPlan.findUnique({ where: { userId } }),
    prisma.rafiqQadaEntry.findMany({
      where: { userId, kind: { in: kinds } },
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      take: LIMITS.logLines * 6,
      select: { id: true, kind: true, action: true, count: true, day: true, batchId: true, source: true, byAdult: true, createdAt: true, by: { select: { name: true } } },
    }),
    g.subject.kind === "CHILD" ? prisma.rafiqUser.findUnique({ where: { id: userId }, select: { name: true } }) : null,
    g.access.plan && g.access.excuseAware ? excuseFacts(g, today) : { spans: null, now: false },
    g.access.plan && g.access.fasting ? adjustmentsFor(g) : [],
  ]);
  const rows: CountRow[] = sums.map((s) => ({ kind: s.kind, action: s.action, count: s._sum.count ?? 0 }));
  const t = totalsOf(rows);
  const totals: QadaView["totals"] = { prayers: t.prayers, ...(g.access.fasting ? { fast: t.fast } : {}) };
  for (const k of kinds) totals[k] = t[k];

  const who = g.viewer === "adult-edit" ? { name: g.subject.name ?? "—", gender: g.subject.gender } : null;
  const view: QadaView = { today, access: g.access, you: g.you, who, kinds, totals, log: logLines(entries, g, names?.name ?? null) };

  if (g.access.plan) {
    const doneToday = new Map(todays.map((r) => [r.kind, r._sum.count ?? 0]));
    const dayRows: DayRow[] = [];
    for (const r of rows) {
      if (r.action === "OWED") dayRows.push({ ...r, day: null });
      else {
        const td = doneToday.get(r.kind) ?? 0;
        dayRows.push({ kind: r.kind, action: "MADE_UP", count: r.count - td, day: addDays(today, -1) });
        if (td) dayRows.push({ kind: r.kind, action: "MADE_UP", count: td, day: today });
      }
    }
    const pg = goalOf(planRow, "prayers");
    const fg = goalOf(planRow, "fast");
    const avg = g.access.excuseAware ? (planRow?.excuseDaysPerMonth ?? null) : null;
    const blocked = g.access.fasting ? blockedFastDays(today, addDays(today, 365 * BLOCKED_YEARS), adjustments) : new Set<string>();
    const ctx = { today, avg, excuses: ex.spans, excuseNow: ex.now, blocked };
    const estimate = planRow?.estimate ? parseEstimate(planRow.estimate, g.access.excuseAware) : null;
    view.plan = {
      prayers: prayerPlan(dayRows, pg, ctx),
      fast: g.access.fasting ? fastPlan(dayRows, fg, ctx) : null,
      goals: {
        prayers: { mode: pg.mode, deadline: pg.deadline, pace: pg.pace },
        fast: g.access.fasting ? { mode: fg.mode, deadline: fg.deadline, pace: fg.pace } : null,
      },
      avg,
      estimate,
    };
  }

  if (g.access.milestones) {
    const shown: { track: QadaTrack; level: Milestone }[] = [];
    const update: Prisma.RafiqQadaPlanUncheckedUpdateInput = {};
    for (const track of ["prayers", "fast"] as const) {
      const tt = t[track];
      const state = track === "prayers" ? { shown: planRow?.prayerMilestone ?? 0, at: planRow?.prayerMilestoneAt ?? 0 } : { shown: planRow?.fastMilestone ?? 0, at: planRow?.fastMilestoneAt ?? 0 };
      const r = nextMilestone(tt.pct, tt.owed, state);
      if (r.show) shown.push({ track, level: r.show });
      // a quiet start again (more owed after 100%): kept now
      else if (r.state.shown !== state.shown || r.state.at !== state.at) {
        if (track === "prayers") Object.assign(update, { prayerMilestone: r.state.shown, prayerMilestoneAt: r.state.at });
        else Object.assign(update, { fastMilestone: r.state.shown, fastMilestoneAt: r.state.at });
      }
    }
    if (Object.keys(update).length) await prisma.rafiqQadaPlan.update({ where: { userId }, data: update });
    if (shown.length) view.milestones = shown;
  }
  return view;
}

type EntryRow = {
  id: string;
  kind: QadaKind;
  action: "OWED" | "MADE_UP";
  count: number;
  day: Date | null;
  batchId: string | null;
  source: LogLine["source"];
  byAdult: boolean;
  createdAt: Date;
  by: { name: string | null } | null;
};

/** The log's lines, newest first: a batch is one line. Dates only for whoever may see them. */
function logLines(entries: EntryRow[], g: QadaGate, childName: string | null): LogLine[] {
  const lines: LogLine[] = [];
  const index = new Map<string, LogLine>();
  for (const e of entries) {
    const key = e.batchId ?? e.id;
    const found = index.get(key);
    if (found) {
      found.parts.push({ kind: e.kind, count: e.count });
      continue;
    }
    if (lines.length >= LIMITS.logLines) continue;
    const line: LogLine = { id: key, action: e.action, source: e.source, parts: [{ kind: e.kind, count: e.count }] };
    if (g.access.dates) {
      line.day = e.day ? isoOf(e.day) : null;
      line.createdAt = e.createdAt.toISOString();
    }
    // who made it: an adult on a child's page; on an adult's view, the child herself too
    if (e.byAdult) line.by = e.by?.name ?? null;
    else if (g.viewer === "adult-edit") line.by = childName ?? "—";
    index.set(key, line);
    lines.push(line);
  }
  for (const l of lines) l.parts.sort((a, b) => KINDS.indexOf(a.kind) - KINDS.indexOf(b.kind));
  return lines;
}

// ---------- the writes ----------

type Result = { view: QadaView; id?: string } | Fail;

const kindAllowed = (g: QadaGate, k: unknown): k is QadaKind => isQadaKind(k) && visibleKinds(g.access).includes(k);
const countOk = (n: unknown): n is number => Number.isInteger(n) && (n as number) >= 1 && (n as number) <= LIMITS.maxCount;
const by = (g: QadaGate) => {
  const a = addedBy(g.subject);
  return { byAdult: a.byAdult, byId: a.adultId };
};
const todayIn = (zone: unknown) => zoneToday(safeTimeZone(typeof zone === "string" ? zone : null));

/** «+1»: one made up, today or up to 7 days before (her days). */
export async function logMadeUp(g: QadaGate, input: { kind: unknown; day?: unknown; zone: unknown }): Promise<Result> {
  if (!kindAllowed(g, input.kind)) return { error: ERR.kind };
  const today = todayIn(input.zone);
  const day = input.day === undefined || input.day === null ? today : input.day;
  if (typeof day !== "string" || !isValidIso(day)) return { error: ERR.day };
  const back = daysBetween(day, today);
  if (back < 0 || back > LIMITS.backDays) return { error: ERR.earlier };
  const e = await prisma.rafiqQadaEntry.create({
    data: { userId: g.subject.id, kind: input.kind, action: "MADE_UP", count: 1, day: dateOnly(day), ...by(g) },
    select: { id: true },
  });
  return { view: await loadView(g, input.zone), id: e.id };
}

/** «+ إضافة قضاء»: owed qada of one kind, with an optional date (not in the future). */
export async function addOwed(g: QadaGate, input: { kind: unknown; count: unknown; day: unknown; zone: unknown }): Promise<Result> {
  if (!kindAllowed(g, input.kind)) return { error: ERR.kind };
  if (!countOk(input.count)) return { error: ERR.count };
  let day: string | null = null;
  if (input.day !== null && input.day !== undefined && input.day !== "") {
    if (typeof input.day !== "string" || !isValidIso(input.day) || daysBetween(input.day, todayIn(input.zone)) < 0 || input.day < "1900-01-01") return { error: ERR.day };
    day = input.day;
  }
  await prisma.rafiqQadaEntry.create({ data: { userId: g.subject.id, kind: input.kind, action: "OWED", count: input.count, day: day ? dateOnly(day) : null, ...by(g) } });
  return { view: await loadView(g, input.zone) };
}

/** «يوم كامل»: that many of each of the five prayers, as one line. */
export async function addFullDays(g: QadaGate, input: { days: unknown; zone: unknown }): Promise<Result> {
  const n = input.days;
  if (!Number.isInteger(n) || (n as number) < 1 || (n as number) > LIMITS.maxFullDays) return { error: ERR.count };
  const batchId = randomUUID();
  await prisma.rafiqQadaEntry.createMany({
    data: PRAYERS.map((kind) => ({ userId: g.subject.id, kind, action: "OWED" as const, count: n as number, batchId, source: "FULL_DAY" as const, ...by(g) })),
  });
  return { view: await loadView(g, input.zone) };
}

/** Deletes one line of the log (an entry, or a whole batch) — only what this viewer sees of it. «تراجع» too. */
export async function deleteLine(g: QadaGate, input: { id: unknown; zone: unknown }): Promise<Result> {
  if (typeof input.id !== "string" || !input.id) return { error: ERR.gone };
  const r = await prisma.rafiqQadaEntry.deleteMany({
    where: { userId: g.subject.id, kind: { in: visibleKinds(g.access) }, OR: [{ id: input.id }, { batchId: input.id }] },
  });
  if (r.count === 0) return { error: ERR.gone };
  return { view: await loadView(g, input.zone) };
}

/**
 * The estimate, saved: her answers (to reopen it), her average (a woman's),
 * and the preview as she edited it — one line of the log, in place of the
 * previous estimate's.
 */
export async function saveEstimate(g: QadaGate, input: { answers: unknown; preview: unknown; zone: unknown }): Promise<Result> {
  if (!g.access.plan) return NOT_AVAILABLE;
  const answers = parseEstimate(input.answers, g.access.excuseAware);
  const preview = parsePreview(input.preview);
  if (!answers || !preview) return { error: ERR.estimate };
  const batchId = randomUUID();
  const data = [
    ...PRAYERS.filter((p) => (preview.prayers[p] ?? 0) > 0).map((kind) => ({ kind, count: preview.prayers[kind] as number })),
    ...(preview.fast > 0 && g.access.fasting ? [{ kind: "FAST" as const, count: preview.fast }] : []),
  ].map((d) => ({ userId: g.subject.id, ...d, action: "OWED" as const, batchId, source: "ESTIMATE" as const, ...by(g) }));
  const avg = g.access.excuseAware ? { excuseDaysPerMonth: answers.excuseDays } : {};
  await prisma.$transaction([
    prisma.rafiqQadaEntry.deleteMany({ where: { userId: g.subject.id, source: "ESTIMATE" } }),
    prisma.rafiqQadaEntry.createMany({ data }),
    prisma.rafiqQadaPlan.upsert({
      where: { userId: g.subject.id },
      create: { userId: g.subject.id, estimate: answers as unknown as Prisma.InputJsonValue, ...avg },
      update: { estimate: answers as unknown as Prisma.InputJsonValue, ...avg },
    }),
  ]);
  return { view: await loadView(g, input.zone) };
}

/** What the estimate would give (the preview), for her answers. */
export function previewEstimate(g: QadaGate, answers: unknown): { prayers: Partial<Record<PrayerKind, number>>; fast: number } | Fail {
  if (!g.access.plan) return NOT_AVAILABLE;
  const a = parseEstimate(answers, g.access.excuseAware);
  if (!a) return { error: ERR.estimate };
  const r = runEstimate(a);
  return { prayers: r.prayers, fast: g.access.fasting ? r.fast : 0 };
}

/** A goal for the prayers or for fasting: a deadline, a pace, or none. Its start (the day, the amount then) is kept. */
export async function setGoal(g: QadaGate, input: { track: unknown; mode: unknown; deadline?: unknown; pace?: unknown; zone: unknown }): Promise<Result> {
  if (!g.access.plan) return NOT_AVAILABLE;
  const track = input.track;
  if (track !== "prayers" && !(track === "fast" && g.access.fasting)) return NOT_AVAILABLE;
  const mode = input.mode as GoalMode;
  if (mode !== "NONE" && mode !== "DEADLINE" && mode !== "PACE") return { error: ERR.pace };
  const today = todayIn(input.zone);
  let deadline: string | null = null;
  let pace: number | null = null;
  if (mode === "DEADLINE") {
    const d = input.deadline;
    if (typeof d !== "string" || !isValidIso(d) || daysBetween(today, d) < 1 || daysBetween(today, d) > 365 * 60) return { error: ERR.deadline };
    deadline = d;
  }
  if (mode === "PACE") {
    const max = track === "fast" ? LIMITS.maxFastPace : LIMITS.maxPrayerPace;
    if (!Number.isInteger(input.pace) || (input.pace as number) < 1 || (input.pace as number) > max) return { error: ERR.pace };
    pace = input.pace as number;
  }
  const t = track as QadaTrack;
  const fields =
    t === "prayers"
      ? { prayerMode: mode, prayerDeadline: deadline ? dateOnly(deadline) : null, prayerPace: pace, prayerFrom: dateOnly(today), prayerBaseline: null }
      : { fastMode: mode, fastDeadline: deadline ? dateOnly(deadline) : null, fastPace: pace, fastFrom: dateOnly(today), fastBaseline: null };
  await prisma.rafiqQadaPlan.upsert({ where: { userId: g.subject.id }, create: { userId: g.subject.id, ...fields }, update: fields });
  // the amount at the start, from the plan as it now stands
  const view = await loadView(g, input.zone);
  const rate = t === "prayers" ? view.plan?.prayers.rate : view.plan?.fast?.rate;
  if (mode === "DEADLINE" && rate) {
    await prisma.rafiqQadaPlan.update({ where: { userId: g.subject.id }, data: t === "prayers" ? { prayerBaseline: rate } : { fastBaseline: rate } });
    return { view: await loadView(g, input.zone) };
  }
  return { view };
}

/** «متوسط أيام العذر في الشهر» (a woman's or a girl's, 0–15). */
export async function setAverage(g: QadaGate, input: { days: unknown; zone: unknown }): Promise<Result> {
  if (!g.access.plan || !g.access.excuseAware) return NOT_AVAILABLE;
  const n = input.days;
  if (!Number.isInteger(n) || (n as number) < 0 || (n as number) > LIMITS.maxExcuseDays) return { error: ERR.avg };
  await prisma.rafiqQadaPlan.upsert({ where: { userId: g.subject.id }, create: { userId: g.subject.id, excuseDaysPerMonth: n as number }, update: { excuseDaysPerMonth: n as number } });
  return { view: await loadView(g, input.zone) };
}

/** A milestone was shown: never again (the owner only). */
export async function ackMilestone(g: QadaGate, input: { track: unknown; level: unknown; zone: unknown }): Promise<Result> {
  if (!g.access.milestones) return NOT_AVAILABLE;
  const track = input.track;
  const level = input.level;
  if ((track !== "prayers" && track !== "fast") || ![25, 50, 75, 100].includes(level as number)) return NOT_AVAILABLE;
  const kinds = track === "prayers" ? [...PRAYERS] : (["FAST"] as QadaKind[]);
  const owed = await prisma.rafiqQadaEntry.aggregate({ where: { userId: g.subject.id, kind: { in: kinds }, action: "OWED" }, _sum: { count: true } });
  const at = owed._sum.count ?? 0;
  const plan = await prisma.rafiqQadaPlan.findUnique({ where: { userId: g.subject.id }, select: { prayerMilestone: true, fastMilestone: true } });
  const shown = Math.max(level as number, track === "prayers" ? (plan?.prayerMilestone ?? 0) : (plan?.fastMilestone ?? 0));
  const fields = track === "prayers" ? { prayerMilestone: shown, prayerMilestoneAt: at } : { fastMilestone: shown, fastMilestoneAt: at };
  await prisma.rafiqQadaPlan.upsert({ where: { userId: g.subject.id }, create: { userId: g.subject.id, ...fields }, update: fields });
  return { view: await loadView(g, input.zone) };
}

/** «حذف كل بيانات القضاء»: the whole log, the goals, the estimate and the average. Typed «حذف». The switch stays. */
export async function deleteAll(g: QadaGate, input: { word: unknown; zone: unknown }): Promise<Result> {
  if (!g.access.deleteAll) return NOT_AVAILABLE;
  if (typeof input.word !== "string" || input.word.trim() !== QADA_DELETE_WORD) return { error: ERR.deleteWord };
  await prisma.$transaction([
    prisma.rafiqQadaEntry.deleteMany({ where: { userId: g.subject.id } }),
    prisma.rafiqQadaPlan.deleteMany({ where: { userId: g.subject.id } }),
  ]);
  return { view: await loadView(g, input.zone) };
}


/** Whether a tracker page shows the card at all (the gate, as the card's own data will ask). */
export async function qadaOn(subjectId?: string): Promise<boolean> {
  return !("error" in (await qadaGate(subjectId, "view")));
}

export type QadaViewerRow = { id: string; name: string; gender: "MALE" | "FEMALE"; checked: boolean; you: boolean };

/**
 * A girl's «من يرى…» list on her settings page, under «القضاء» (the same list
 * as «أيام العذر»'s, which may be off): every adult of the family, checked by
 * her rows or else by the default. null: not a girl, or «القضاء» doesn't
 * reach the family.
 */
export async function childQadaList(familyId: string, child: { id: string; gender: "MALE" | "FEMALE" }, viewerId: string): Promise<QadaViewerRow[] | null> {
  if (child.gender !== "FEMALE" || !(await familyQadaAllowed(familyId))) return null;
  const [members, overrides] = await Promise.all([
    prisma.familyMember.findMany({ where: { familyId }, orderBy: { joinedAt: "asc" }, select: { userId: true, user: { select: { name: true, gender: true } } } }),
    viewerOverrides(child.id),
  ]);
  return familyViewerChecks(
    members.map((m) => ({ id: m.userId, name: m.user.name ?? "—", gender: m.user.gender })),
    overrides,
  ).map((a) => ({ ...a, you: a.id === viewerId }));
}
