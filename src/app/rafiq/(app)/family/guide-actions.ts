"use server";

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { resolveSubject } from "@/lib/rafiq/subject";
import { familyAccess } from "@/lib/family/data";
import { familyGuideOnFor } from "@/lib/family/guide";
import { checkFamilyGuideValue, isChildStartKey } from "@/lib/guide/family-keys";
import type { EnableFeature } from "@/lib/guide/help/types";
import type { ChildFeature } from "@/lib/family/rules";
import { REVIEW_DAYS_ON_ENABLE } from "@/lib/guide/help/rafiq/ui";
import { setChildFeatureAction } from "./actions";
import { setReviewRemindersAction } from "../settings/actions";

// The adults' side of «العائلة»'s guide (FAMILY_GUIDE_EMAILS): «تفعيل الآن» on
// a child's pages, where her start questions stand, and «فهمت» on the join
// card. Each re-checks the adult's rights from the database (resolveSubject,
// familyAccess) and that the guide reaches the family.

export type FamilyGuideResult = { error?: string };

const OFF: { error: string } = { error: "هذه الخدمة غير متاحة حاليًا" };
const FAILED: { error: string } = { error: "تعذّر الحفظ، يُرجى المحاولة مرة أخرى" };

const json = (v: Prisma.InputJsonValue | null) => (v === null ? Prisma.DbNull : v);

/** A child of a family the guide reaches, and an adult who may change her; or an error. */
async function editableChild(childId: unknown): Promise<{ id: string } | { error: string }> {
  const s = await resolveSubject(childId, "manage");
  if ("error" in s) return s;
  if (s.self || s.kind !== "CHILD") return OFF;
  const row = await prisma.rafiqUser.findUnique({ where: { id: s.id }, select: { familyId: true } });
  if (!row?.familyId || !(await familyGuideOnFor(row.familyId))) return OFF;
  return { id: s.id };
}

const SWITCH: Partial<Record<EnableFeature, ChildFeature>> = {
  streak: "streak",
  summary: "summary",
  agenda: "agenda",
  goal: "goal",
  similar: "mutashabihat",
  tajweed: "tajweed",
  homeLog: "homeLog",
  highlight: "highlight",
};

/** «تفعيل الآن» in a child's help: her switch on (review reminders: 14 days), through the settings' own actions. */
export async function enableChildFeatureAction(childId: unknown, feature: unknown): Promise<FamilyGuideResult> {
  const child = await editableChild(childId);
  if ("error" in child) return child;
  if (feature === "review") {
    const fd = new FormData();
    fd.set("subjectId", child.id);
    fd.set("on", "1");
    fd.set("days", String(REVIEW_DAYS_ON_ENABLE));
    const r = await setReviewRemindersAction(null, fd);
    return r?.error ? { error: r.error } : {};
  }
  const sw = typeof feature === "string" ? SWITCH[feature as EnableFeature] : undefined;
  if (!sw) return FAILED;
  const r = await setChildFeatureAction(child.id, sw, true);
  return r?.error ? { error: r.error } : {};
}

/** Where her start questions stand (childStart.step / done / cardHidden), set by an adult with edit rights. */
export async function markChildStartAction(childId: unknown, key: unknown, value: unknown = null): Promise<FamilyGuideResult> {
  const child = await editableChild(childId);
  if ("error" in child) return child;
  if (!isChildStartKey(key)) return FAILED;
  const checked = checkFamilyGuideValue(key, value);
  if (checked === undefined) return FAILED;
  await prisma.guideState.upsert({
    where: { rafiqUserId_key: { rafiqUserId: child.id, key } },
    create: { rafiqUserId: child.id, key, value: json(checked) },
    update: { value: json(checked) },
  });
  return {};
}

/** «فهمت» on the welcome card of a family she joined. */
export async function welcomeJoinAction(familyId: unknown): Promise<FamilyGuideResult> {
  const access = await familyAccess(familyId);
  if ("error" in access) return access;
  if (!(await familyGuideOnFor(access.family.id))) return OFF;
  const value = { f: access.family.id };
  await prisma.guideState.upsert({
    where: { rafiqUserId_key: { rafiqUserId: access.user.id, key: "family.welcomed" } },
    create: { rafiqUserId: access.user.id, key: "family.welcomed", value },
    update: { value },
  });
  return {};
}
