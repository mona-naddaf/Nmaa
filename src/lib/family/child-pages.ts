import "server-only";
import { prisma } from "@/lib/db";
import type { PersonRef } from "@/lib/rafiq/scope";
import { getMemorization, type MemorizationView } from "@/lib/rafiq/memorization";
import { getCommitment, type CommitmentData } from "@/lib/rafiq/commitment";
import { rafiqTajweedSummary } from "@/lib/rafiq/tajweed";
import type { TajweedSummary } from "@/lib/tajweed/summary";
import { familyAccess, type FamilyAccess } from "./data";

// What the child's pages need beyond her Rafiq data: the family's adults by
// name (for «مع {الاسم}» / «سجّلها {الاسم}»), her switches (step 4), and — on
// an adult's page — that the child really is in that adult's family. What
// may be changed is still decided by the actions themselves
// (src/lib/rafiq/subject.ts).

/** The family's adults, by id. An adult who left is no longer named («أحد البالغين»). */
export async function familyAdults(familyId: string): Promise<Record<string, PersonRef>> {
  const rows = await prisma.familyMember.findMany({ where: { familyId }, select: { userId: true, user: { select: { name: true, gender: true } } } });
  return Object.fromEntries(rows.map((r) => [r.userId, { name: r.user.name ?? "—", gender: r.user.gender }]));
}

/** A child's switches (all off by default; the adults set them). */
export type ChildFlags = {
  homeLog: boolean;
  homeMistakes: boolean;
  goal: boolean;
  mutashabihat: boolean;
  tajweed: boolean;
  agenda: boolean;
  summary: boolean;
  streak: boolean;
  // null: review reminders off
  reviewReminderDays: number | null;
};

const FLAGS_SELECT = {
  homeLogEnabled: true,
  homeMistakesEnabled: true,
  goalEnabled: true,
  mutashabihatEnabled: true,
  tajweedDetailEnabled: true,
  agendaEnabled: true,
  summaryEnabled: true,
  streakEnabled: true,
  reviewReminderDays: true,
} as const;

type FlagRow = { [K in keyof typeof FLAGS_SELECT]: K extends "reviewReminderDays" ? number | null : boolean };

const flagsOf = (r: FlagRow): ChildFlags => ({
  homeLog: r.homeLogEnabled,
  // marking her own home mistakes only makes sense with the home log on
  homeMistakes: r.homeLogEnabled && r.homeMistakesEnabled,
  goal: r.goalEnabled,
  mutashabihat: r.mutashabihatEnabled,
  tajweed: r.tajweedDetailEnabled,
  agenda: r.agendaEnabled,
  summary: r.summaryEnabled,
  streak: r.streakEnabled,
  reviewReminderDays: r.reviewReminderDays,
});

export async function childFlags(childId: string): Promise<ChildFlags> {
  return flagsOf(await prisma.rafiqUser.findUniqueOrThrow({ where: { id: childId }, select: FLAGS_SELECT }));
}

export type ChildForAdult = {
  access: FamilyAccess;
  child: { id: string; name: string; gender: "MALE" | "FEMALE"; flags: ChildFlags };
  viewer: "adult-edit" | "adult-view";
};

/** An adult of the family on one of its children's pages, or null (not hers, or not a child of this family). */
export async function childForAdult(familyId: string, childId: string): Promise<ChildForAdult | null> {
  const access = await familyAccess(familyId);
  if ("error" in access) return null;
  const child = await prisma.rafiqUser.findFirst({
    where: { id: childId, familyId: access.family.id, kind: "CHILD" },
    select: { id: true, name: true, gender: true, ...FLAGS_SELECT },
  });
  if (!child) return null;
  return {
    access,
    child: { id: child.id, name: child.name ?? "", gender: child.gender, flags: flagsOf(child) },
    viewer: access.canEditChildren ? "adult-edit" : "adult-view",
  };
}

/** «صفحتي» of a child, as her switches show it: the goal only while its switch is on. */
export async function childHomeData(childId: string, flags: ChildFlags): Promise<{
  data: MemorizationView | null;
  commitment: CommitmentData;
  tajweedSummary: TajweedSummary | null;
}> {
  const [data, commitment, tajweedSummary] = await Promise.all([getMemorization(childId), getCommitment(childId), rafiqTajweedSummary(childId)]);
  return { data: data && (flags.goal ? data : { ...data, goal: null }), commitment, tajweedSummary };
}
