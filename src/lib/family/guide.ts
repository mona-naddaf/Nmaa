import "server-only";
import { cache } from "react";
import { prisma } from "@/lib/db";
import { getRafiqUser } from "@/lib/rafiq/session";
import { highlightAllowed } from "@/lib/highlight/enabled";
import type { PersonGender } from "@/lib/text/gender";
import { familyGuideAllowed, familyGuideListed } from "./guide-enabled";
import { toFamilyStates, type FamilyGuideStates } from "@/lib/guide/family-keys";
import { founderLabel } from "@/lib/guide/help/family/text";
import type { ChildSwitches } from "@/lib/guide/help/family/build";

// What «العائلة»'s guide needs from the database, read only while
// FAMILY_GUIDE_EMAILS lists anyone (familyGuideListed), and always decided by
// the family founder's email. Nothing here writes.

export type FamilyGuideFamily = {
  id: string;
  name: string;
  // the founder as the view-only lines name her (U3)
  founder: string;
  // FAMILY_GUIDE_EMAILS reaches this family
  on: boolean;
  role: "founder" | "edit" | "view";
};

/** The signed-in adult's families, each with whether the guide reaches it; null when it reaches none here. */
export const adultFamilyGuide = cache(async (): Promise<{ gender: PersonGender; userId: string; families: FamilyGuideFamily[]; listOn: boolean; states: FamilyGuideStates } | null> => {
  if (!familyGuideListed()) return null;
  const user = await getRafiqUser();
  if (!user) return null;
  const rows = await prisma.familyMember.findMany({
    where: { userId: user.id },
    select: { canEditChildren: true, family: { select: { id: true, name: true, founderId: true, founder: { select: { email: true, name: true, gender: true } } } } },
  });
  const families = rows.map(({ canEditChildren, family: f }) => ({
    id: f.id,
    name: f.name,
    founder: founderLabel(f.founder),
    on: familyGuideAllowed(f.founder.email),
    role: f.founderId === user.id ? ("founder" as const) : canEditChildren ? ("edit" as const) : ("view" as const),
  }));
  // «عائلاتي», creating and joining: her own email, or a family of hers it reaches
  const listOn = familyGuideAllowed(user.email) || families.some((f) => f.on);
  if (!listOn) return null;
  const states = toFamilyStates(await prisma.guideState.findMany({ where: { rafiqUserId: user.id, key: { in: ["family.joined", "family.welcomed"] } }, select: { key: true, value: true } }));
  return { gender: user.gender, userId: user.id, families, listOn, states };
});

/** Whether the guide reaches the family a child belongs to (the founder's email). */
export async function familyGuideOnFor(familyId: string): Promise<boolean> {
  if (!familyGuideListed()) return false;
  const f = await prisma.family.findUnique({ where: { id: familyId }, select: { founder: { select: { email: true } } } });
  return !!f && familyGuideAllowed(f.founder.email);
}

export type ChildGuideFacts = {
  id: string;
  name: string;
  gender: PersonGender;
  familyId: string;
  familyName: string;
  founder: string;
  founderEmail: string | null;
  // added while the guide reached her family: the start questions and the welcome lines
  isNew: boolean;
  states: FamilyGuideStates;
  switches: ChildSwitches;
  // «التظليل» reaches her family (HIGHLIGHT_EMAILS)
  highlight: boolean;
};

/** A child's facts for her guide, or null when the guide doesn't reach her family. */
export const childGuideFacts = cache(async (childId: string): Promise<ChildGuideFacts | null> => {
  if (!familyGuideListed()) return null;
  const c = await prisma.rafiqUser.findUnique({
    where: { id: childId },
    select: {
      kind: true,
      name: true,
      gender: true,
      guideNewAt: true,
      homeLogEnabled: true,
      homeMistakesEnabled: true,
      goalEnabled: true,
      mutashabihatEnabled: true,
      tajweedDetailEnabled: true,
      agendaEnabled: true,
      summaryEnabled: true,
      streakEnabled: true,
      highlightEnabled: true,
      reviewReminderDays: true,
      guideStates: { select: { key: true, value: true } },
      family: { select: { id: true, name: true, founder: { select: { email: true, name: true, gender: true } } } },
    },
  });
  if (!c || c.kind !== "CHILD" || !c.family || !familyGuideAllowed(c.family.founder.email)) return null;
  return {
    id: childId,
    name: c.name ?? "",
    gender: c.gender,
    familyId: c.family.id,
    familyName: c.family.name,
    founder: founderLabel(c.family.founder),
    founderEmail: c.family.founder.email,
    isNew: c.guideNewAt !== null,
    states: toFamilyStates(c.guideStates),
    switches: {
      homeLog: c.homeLogEnabled,
      homeMistakes: c.homeLogEnabled && c.homeMistakesEnabled,
      goal: c.goalEnabled,
      similar: c.mutashabihatEnabled,
      tajweed: c.tajweedDetailEnabled,
      agenda: c.agendaEnabled,
      summary: c.summaryEnabled,
      streak: c.streakEnabled,
      review: c.reviewReminderDays !== null,
      highlight: c.highlightEnabled,
    },
    highlight: highlightAllowed(c.family.founder.email),
  };
});
