import "server-only";
import { prisma } from "@/lib/db";
import type { Subject } from "@/lib/rafiq/subject";
import { addDays } from "@/lib/tracker/rules";
import { loadExcuses, loadPauses, notDue, ownExcuse, pausedNow } from "./rafiq-data";
import type { Excuse } from "./rules";
import type { Actor } from "./texts";
import { familyExcuseAllowed, viewerOverrides } from "./family-data";
import { familySees } from "./visibility";
import { quietHome, type QuietHome } from "./home-quiet";
import type { MemorizationView } from "@/lib/rafiq/memorization";
import type { CommitmentData } from "@/lib/rafiq/commitment";

// «أيام العذر» for one «رفيق الحفظ» page or action (src/lib/rafiq/subject.ts):
// a woman's own, or a girl's in «العائلة» seen by herself or an adult of
// her family. Decided here, before anything about an excuse is loaded.

export type SubjectExcuse = {
  // her excuses count in her scores (whoever looks)
  count: boolean;
  // the one looking sees it (and, with on, starts and ends it)
  show: boolean;
  // her switch is on (the button and each item's setting)
  on: boolean;
  // the one acting, for the wording
  you: "MALE" | "FEMALE";
  // an adult acting on a girl's page (the record names them); null: she herself
  adultId: string | null;
};

const NONE = (you: "MALE" | "FEMALE"): SubjectExcuse => ({ count: false, show: false, on: false, you, adultId: null });

export async function subjectExcuse(s: Pick<Subject, "id" | "kind" | "gender" | "self" | "actorId" | "actorKind">): Promise<SubjectExcuse> {
  if (s.kind === "ADULT") {
    // a woman's own: hers alone
    if (!s.self) return NONE(s.gender);
    const own = await ownExcuse(s.id);
    return { count: own.show, show: own.show, on: own.on, you: s.gender, adultId: null };
  }
  const child = await prisma.rafiqUser.findUniqueOrThrow({ where: { id: s.id }, select: { gender: true, familyId: true, excuseEnabled: true } });
  const actor = s.actorKind === "ADULT" ? await prisma.rafiqUser.findUniqueOrThrow({ where: { id: s.actorId }, select: { gender: true } }) : { gender: child.gender };
  if (child.gender !== "FEMALE" || !child.familyId || !(await familyExcuseAllowed(child.familyId))) return NONE(actor.gender);
  // seeing doesn't need her switch: her past excuses stay hers to see after it's turned off
  const show =
    s.actorKind !== "ADULT" ||
    familySees({ kind: "ADULT", id: s.actorId, gender: actor.gender }, { id: s.id, gender: "FEMALE", excuseEnabled: true }, await viewerOverrides(s.id));
  return { count: true, show, on: show && child.excuseEnabled, you: actor.gender, adultId: s.actorKind === "ADULT" ? s.actorId : null };
}

/** What «جدول المتابعة» gets of her excuse (only for whoever sees it; undefined otherwise). */
export type TrackerExcuse = {
  excuses: Excuse[];
  on: boolean;
  pausedNow: boolean;
  // the one acting, for the wording (B6, C6)
  you: "MALE" | "FEMALE";
  // C8: her name, on an adult's page («سارة معذورة منذ…»)
  name?: string;
  // C14: who started the open one («العائلة»)
  startedBy?: Actor | null;
};

export async function trackerExcuse(userId: string, ex: SubjectExcuse, family?: { name: string; adultPage: boolean }): Promise<TrackerExcuse | undefined> {
  if (!ex.show) return undefined;
  const [excuses, paused, startedBy] = await Promise.all([
    loadExcuses(userId, addDays(new Date().toISOString().slice(0, 10), -10)),
    pausedNow(userId),
    family ? openStarter(userId, family.name) : null,
  ]);
  return { excuses, on: ex.on, pausedNow: paused, you: ex.you, ...(family ? { startedBy, ...(family.adultPage ? { name: family.name } : {}) } : {}) };
}

/** For a viewer who may not see it while it counts: only the «day:itemId» pairs not due (quietLens). */
export async function trackerQuiet(userId: string, ex: SubjectExcuse): Promise<string[] | undefined> {
  return ex.count && !ex.show ? notDue(userId, addDays(new Date().toISOString().slice(0, 10), -10)) : undefined;
}

/** Who started a girl's open excuse: she herself, or an adult by name (null: none open, or that adult's account is gone). */
async function openStarter(childId: string, name: string): Promise<Actor | null> {
  const r = await prisma.rafiqExcuse.findFirst({ where: { userId: childId, endDay: null }, select: { startedBy: true, startedByAdult: { select: { name: true, gender: true } } } });
  if (!r) return null;
  if (r.startedBy === "SELF") return { kind: "PERSON", name, gender: "FEMALE" };
  return r.startedByAdult ? { kind: "PERSON", name: r.startedByAdult.name ?? "—", gender: r.startedByAdult.gender } : null;
}

/**
 * «صفحتي» (a girl's, «العائلة»): for whoever sees her excuse, her paused
 * stretches and whether she's paused now (🔥 D5, goal D6); for anyone else
 * while it counts, her 🔥 and goal as results only (quietHome); otherwise
 * nothing.
 */
export async function homeExcuse(
  userId: string,
  ex: SubjectExcuse,
  data: MemorizationView,
  commitment: CommitmentData,
): Promise<{ paused: { from: string; to: string | null }[]; pausedNow: boolean } | { quiet: QuietHome } | Record<string, never>> {
  if (ex.show) return { paused: await loadPauses(userId), pausedNow: await pausedNow(userId) };
  if (!ex.count) return {};
  const home = {
    plan: data.plan,
    goal: data.goal,
    sessions: data.history.map((h) => ({ ...h, prior: h.source === "PRIOR" })),
    schedule: commitment.schedule,
    loggedDays: commitment.loggedDays,
    createdAt: commitment.createdAt,
  };
  return { quiet: quietHome(home, await loadPauses(userId), new Date().toISOString().slice(0, 10)) };
}
