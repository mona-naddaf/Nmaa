"use server";

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { resolveSubject } from "@/lib/rafiq/subject";
import { guideEnabled } from "@/lib/guide/enabled";
import { checkGuideValue, isClientKey } from "@/lib/guide/keys";
import { resetFor, type GuideReset, type GuideStates } from "@/lib/guide/rules";
import { toStates } from "@/lib/guide/state";

// The guidance's own state (src/lib/guide): what she finished or dismissed.
// Each action re-checks that guidance is on and who is signed in — always her
// own account (an adult; a child never has guide state) — and takes only the
// keys and values the allowlist knows, so every account holds a bounded set
// of rows. Nothing here touches her memorization or tracker data.

export type GuideResult = { error?: string };

const OFF: GuideResult = { error: "هذه الخدمة غير متاحة حاليًا" };
const FAILED: GuideResult = { error: "تعذّر الحفظ، يُرجى المحاولة مرة أخرى" };

const json = (v: Prisma.InputJsonValue | null) => (v === null ? Prisma.DbNull : v);

/** Marks one thing finished or dismissed (e.g. «welcome.tracker»), with its value when it has one. */
export async function markGuideAction(key: unknown, value: unknown = null): Promise<GuideResult> {
  if (!guideEnabled()) return OFF;
  const user = await resolveSubject(null, "self");
  if ("error" in user) return user;
  if (!isClientKey(key)) return FAILED;
  const checked = checkGuideValue(key, value);
  if (checked === undefined) return FAILED;
  await prisma.guideState.upsert({
    where: { rafiqUserId_key: { rafiqUserId: user.id, key } },
    create: { rafiqUserId: user.id, key, value: json(checked) },
    update: { value: json(checked) },
  });
  return {};
}

/**
 * The two settings buttons: «إعادة أسئلة البداية» (wizard) and «إظهار
 * الإرشادات من جديد» (hints). Returns her rows afterwards for the provider.
 */
export async function resetGuideAction(kind: unknown): Promise<GuideResult & { states?: GuideStates }> {
  if (!guideEnabled()) return OFF;
  const user = await resolveSubject(null, "self");
  if ("error" in user) return user;
  if (kind !== "wizard" && kind !== "hints") return FAILED;
  const { remove, set } = resetFor(kind satisfies GuideReset);
  await prisma.$transaction([
    prisma.guideState.deleteMany({ where: { rafiqUserId: user.id, key: { in: remove } } }),
    prisma.guideState.upsert({
      where: { rafiqUserId_key: { rafiqUserId: user.id, key: set } },
      create: { rafiqUserId: user.id, key: set, value: Prisma.DbNull },
      update: {},
    }),
  ]);
  const rows = await prisma.guideState.findMany({ where: { rafiqUserId: user.id }, select: { key: true, value: true } });
  return { states: toStates(rows) };
}
