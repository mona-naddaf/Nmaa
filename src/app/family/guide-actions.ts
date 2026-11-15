"use server";

import { prisma } from "@/lib/db";
import { getFamilyChild } from "@/lib/family/child-session";
import { familyGuideOnFor } from "@/lib/family/guide";
import { isChildWelcomeKey } from "@/lib/guide/family-keys";
import { Prisma } from "@prisma/client";

// The child's own guide state («العائلة», FAMILY_GUIDE_EMAILS): only «فهمت»
// on a page's welcome line, on her own row. Re-checked here: her session,
// the guide reaching her family, and a welcome key, nothing else.

export type ChildGuideResult = { error?: string };

const OFF: ChildGuideResult = { error: "هذه الخدمة غير متاحة حاليًا" };
const FAILED: ChildGuideResult = { error: "تعذّر الحفظ، يُرجى المحاولة مرة أخرى" };

export async function markChildWelcomeAction(key: unknown): Promise<ChildGuideResult> {
  const child = await getFamilyChild();
  if (!child) return OFF;
  if (!isChildWelcomeKey(key)) return FAILED;
  if (!(await familyGuideOnFor(child.familyId))) return OFF;
  await prisma.guideState.upsert({
    where: { rafiqUserId_key: { rafiqUserId: child.id, key } },
    create: { rafiqUserId: child.id, key, value: Prisma.DbNull },
    update: {},
  });
  return {};
}
