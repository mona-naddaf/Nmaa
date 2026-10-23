import "server-only";
import { cache } from "react";
import { prisma } from "@/lib/db";
import { getRafiqUser } from "@/lib/rafiq/session";
import { guideEnabled } from "./enabled";
import { checkGuideValue, isGuideKey } from "./keys";
import type { GuideStates } from "./rules";

// Her guide state for the provider and the guide pages: whether the account
// is new (guideNewAt) and her GuideState rows, shaped to what the UI needs.
// One query per request (cached); with guidance off, or nobody signed in,
// nothing is read at all. Rows whose key or value the code no longer knows
// are left out, so a renamed key can't break a page.

export type GuideSnapshot = { isNew: boolean; states: GuideStates };

export const getGuide = cache(async (): Promise<GuideSnapshot | null> => {
  if (!guideEnabled()) return null;
  const user = await getRafiqUser();
  if (!user) return null;
  const row = await prisma.rafiqUser.findUnique({
    where: { id: user.id },
    select: { kind: true, guideNewAt: true, guideStates: { select: { key: true, value: true } } },
  });
  // getRafiqUser only returns adults; checked again here
  if (!row || row.kind !== "ADULT") return null;
  return { isNew: row.guideNewAt !== null, states: toStates(row.guideStates) };
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
