import { highlightAllowed } from "@/lib/highlight/enabled";
import "server-only";
import { cache } from "react";
import { prisma } from "@/lib/db";
import { getRafiqUser } from "@/lib/rafiq/session";
import { familyEnabled } from "@/lib/family/enabled";
import type { PersonGender } from "@/lib/text/gender";
import { guideEnabled, guidePreviewAllowed } from "./enabled";
import { excuseAllowed } from "@/lib/excuse/enabled";
import { checkGuideValue, isGuideKey } from "./keys";
import { excuseSnapshotParts } from "./help/rafiq/excuse";
import type { ExcuseGuide } from "./help/rafiq/excuse-types";
import type { GuideStates } from "./rules";
import type { HelpFacts } from "./help/types";

// Her guide state for the provider and the guide pages: whether the account
// is new (guideNewAt) and her GuideState rows, shaped to what the UI needs,
// plus what the help's «أرِني» has to know (her gender, which features are
// on, a city, a plan, a family she founds). One query per request (cached);
// with guidance off, or nobody signed in, nothing is read at all. Rows whose
// key or value the code no longer knows are left out, so a renamed key can't
// break a page.

// preview: GUIDE_PREVIEW_EMAILS lets her see what's being tried; excuse: her
// guide of «أيام العذر». Both left out, not empty, for anyone they aren't for
export type GuideSnapshot = { isNew: boolean; states: GuideStates; gender: PersonGender; facts: HelpFacts; preview?: true; excuse?: ExcuseGuide };

export const getGuide = cache(async (): Promise<GuideSnapshot | null> => {
  if (!guideEnabled()) return null;
  const user = await getRafiqUser();
  if (!user) return null;
  const row = await prisma.rafiqUser.findUnique({
    where: { id: user.id },
    select: {
      kind: true,
      email: true,
      gender: true,
      guideNewAt: true,
      excuseEnabled: true,
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
  const preview = guidePreviewAllowed(row.email);
  const parts = excuseSnapshotParts({
    kind: row.kind,
    gender: row.gender,
    excuseAllowed: excuseAllowed(row.email),
    previewAllowed: preview,
    on: row.excuseEnabled,
    states: toStates(row.guideStates),
  });
  return {
    ...(preview ? { preview: true as const } : {}),
    ...(parts.excuse ? { excuse: parts.excuse } : {}),
    isNew: row.guideNewAt !== null,
    states: parts.states,
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
      ...(highlightAllowed(row.email) ? { highlight: true } : {}),
      ...parts.facts,
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
