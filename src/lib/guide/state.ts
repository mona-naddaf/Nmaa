import "server-only";
import { cache } from "react";
import { prisma } from "@/lib/db";
import { getRafiqUser } from "@/lib/rafiq/session";
import { familyEnabled } from "@/lib/family/enabled";
import type { PersonGender } from "@/lib/text/gender";
import { guideEnabled } from "./enabled";
import { checkGuideValue, isGuideKey } from "./keys";
import type { GuideStates } from "./rules";
import type { HelpFacts } from "./help/types";

// Her guide state for the provider and the guide pages: whether the account
// is new (guideNewAt) and her GuideState rows, shaped to what the UI needs,
// plus what the help's «أرِني» has to know (her gender, which features are
// on, a city, a plan, a family she founds). One query per request (cached);
// with guidance off, or nobody signed in, nothing is read at all. Rows whose
// key or value the code no longer knows are left out, so a renamed key can't
// break a page.

export type GuideSnapshot = { isNew: boolean; states: GuideStates; gender: PersonGender; facts: HelpFacts };

export const getGuide = cache(async (): Promise<GuideSnapshot | null> => {
  if (!guideEnabled()) return null;
  const user = await getRafiqUser();
  if (!user) return null;
  const row = await prisma.rafiqUser.findUnique({
    where: { id: user.id },
    select: {
      kind: true,
      gender: true,
      guideNewAt: true,
      guideStates: { select: { key: true, value: true } },
      agendaEnabled: true,
      summaryEnabled: true,
      mutashabihatEnabled: true,
      tajweedDetailEnabled: true,
      reviewReminderDays: true,
      prayerLat: true,
      planTemplate: true,
      // the founder step of «كيف أحذف حسابي؟» only exists with «العائلة» on
      ...(familyEnabled() ? { _count: { select: { foundedFamilies: true } } } : {}),
    },
  });
  // getRafiqUser only returns adults; checked again here
  if (!row || row.kind !== "ADULT") return null;
  return {
    isNew: row.guideNewAt !== null,
    states: toStates(row.guideStates),
    gender: row.gender,
    facts: {
      features: {
        agenda: row.agendaEnabled,
        summary: row.summaryEnabled,
        similar: row.mutashabihatEnabled,
        tajweed: row.tajweedDetailEnabled,
        review: row.reviewReminderDays !== null,
      },
      city: row.prayerLat !== null,
      plan: row.planTemplate !== null,
      founder: ((row as { _count?: { foundedFamilies: number } })._count?.foundedFamilies ?? 0) > 0,
    },
  };
});

export function toStates(rows: { key: string; value: unknown }[]): GuideStates {
  const states: GuideStates = {};
  for (const r of rows) {
    if (!isGuideKey(r.key)) continue;
    const value = checkGuideValue(r.key, r.value);
    if (value !== undefined) states[r.key] = value;
  }
  return states;
}
