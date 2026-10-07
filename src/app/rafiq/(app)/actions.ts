"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getRafiqUser } from "@/lib/rafiq/session";
import { getPlan, getReach } from "@/lib/rafiq/memorization";
import { acceptSessionDay, occurredAtFor } from "@/lib/rafiq/days";
import { advancesPosition, calculatePageRange, classifyRecitation, type RecitationSituation, type SessionType } from "@/lib/recitation/logic";
import { validateFlaggedWords } from "@/lib/recitation/flagged-words";
import { planProblem, priorProblem, TEMPLATE_KEY_PLAN, type PriorPartial, type TemplateKey } from "@/lib/students/new-student";
import { acceptLocalDay } from "@/lib/home-log/rules";
import { AYAH_COUNT } from "@/lib/quran-data";

// «رفيق الحفظ»: her plan, her sessions and her mistakes. Every action
// re-checks her session and only ever touches rows with her user id.

export type RafiqResult = { error?: string };

const SIGNED_OUT = { error: "انتهت الجلسة، يُرجى تسجيل الدخول مرة أخرى" };
const NO_PLAN = { error: "يُرجى إعداد خطة الحفظ أولًا" };

const LIMITS = {
  sessionsPerDay: 100,
  noteMax: 300,
  reasonMax: 300,
};

const SESSION_TYPES: SessionType[] = ["NEW", "REVIEW", "LINK"];
const QUALITIES = ["EXCELLENT", "GOOD", "NEEDS_REPEAT"] as const;
type Quality = (typeof QUALITIES)[number];

function refresh() {
  revalidatePath("/rafiq", "layout");
}

export type SaveSessionInput = {
  type: SessionType;
  surahNumber: number;
  fromAyah: number;
  toAyah: number;
  quality: Quality | null;
  notes: string;
  reason: string;
  // her local day for the session (today or up to 2 days back), and her local today
  day: string;
  today: string;
  mistakes: unknown;
};

export async function saveSessionAction(input: SaveSessionInput): Promise<RafiqResult> {
  const user = await getRafiqUser();
  if (!user) return SIGNED_OUT;
  const { planTemplate, planChangedAt, plan } = await getPlan(user.id);
  if (!planTemplate) return NO_PLAN;

  const type = input?.type;
  if (!SESSION_TYPES.includes(type)) return { error: "نوع الجلسة غير صحيح" };
  const surahNumber = Number(input.surahNumber);
  const fromAyah = Number(input.fromAyah);
  const toAyah = Number(input.toAyah);
  const quality = input.quality === null || input.quality === undefined ? null : QUALITIES.includes(input.quality) ? input.quality : undefined;
  if (quality === undefined) return { error: "مستوى التسميع غير صحيح" };
  const notes = String(input.notes ?? "").trim();
  const reasonText = String(input.reason ?? "").trim();
  if (notes.length > LIMITS.noteMax) return { error: `يُرجى ألّا تزيد الملاحظات على ${LIMITS.noteMax} حرف` };
  if (reasonText.length > LIMITS.reasonMax) return { error: `يُرجى ألّا يزيد السبب على ${LIMITS.reasonMax} حرف` };

  const day = acceptSessionDay(input.day, input.today);
  if (!day) return { error: "يمكن تسجيل جلسة لليوم أو ليومين سابقين فقط — يُرجى تحديث الصفحة" };

  const pages = calculatePageRange(surahNumber, fromAyah, toAyah);
  if ("error" in pages) return { error: pages.error };

  // only new memorization goes through the gap check (and may need a reason);
  // a review/link never moves her, whatever range it names
  let situation: RecitationSituation | null = null;
  let requiresReason = false;
  if (advancesPosition({ type })) {
    const reach = await getReach(user.id, plan, planChangedAt);
    const c = classifyRecitation(plan, reach, surahNumber, fromAyah, { self: user.gender });
    situation = c.situation;
    requiresReason = c.requiresReason;
    if (requiresReason && !reasonText) return { error: "يُرجى كتابة سبب هذا التسجيل قبل الحفظ" };
  }

  const checked = validateFlaggedWords(input.mistakes, surahNumber, fromAyah, toAyah);
  if ("error" in checked) return { error: checked.error };

  const recent = await prisma.rafiqSession.count({
    where: { userId: user.id, createdAt: { gt: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
  });
  if (recent >= LIMITS.sessionsPerDay) return { error: "تم بلوغ الحدّ اليومي لتسجيل الجلسات، ويمكن التسجيل مجددًا غدًا" };

  const today = acceptLocalDay(String(input.today))!;
  const occurredAt = occurredAtFor(day, today);
  await prisma.rafiqSession.create({
    data: {
      userId: user.id,
      type,
      surahNumber,
      fromAyah,
      toAyah,
      pagesCalculated: pages.totalPages,
      quality,
      situation,
      reason: requiresReason ? reasonText : null,
      notes: notes || null,
      day: new Date(`${day}T00:00:00Z`),
      occurredAt,
      // same statement as the session, so they're saved together or not at all
      mistakes: {
        createMany: {
          data: checked.words.map((w) => ({
            userId: user.id,
            surahNumber,
            ayah: w.ayah,
            wordPosition: w.wordPosition,
            wordText: w.wordText,
            type: w.type,
            flaggedAt: occurredAt,
          })),
        },
      },
    },
  });
  refresh();
  return {};
}

/** Deletes one of her sessions (its flagged words go with it). */
export async function deleteSessionAction(sessionId: string): Promise<RafiqResult> {
  const user = await getRafiqUser();
  if (!user) return SIGNED_OUT;
  const { count } = await prisma.rafiqSession.deleteMany({ where: { id: String(sessionId ?? ""), userId: user.id } });
  if (count === 0) return { error: "هذه الجلسة غير موجودة" };
  refresh();
  return {};
}

/** Resolves every open flag on one word of hers. */
export async function resolveMistakeAction(surahNumber: number, ayah: number, wordPosition: number): Promise<{ error: string } | { ok: true }> {
  const user = await getRafiqUser();
  if (!user) return { error: SIGNED_OUT.error };
  const { count } = await prisma.rafiqMistake.updateMany({
    where: { userId: user.id, surahNumber: Number(surahNumber), ayah: Number(ayah), wordPosition: Number(wordPosition), resolvedAt: null },
    data: { resolvedAt: new Date() },
  });
  if (count === 0) return { error: "هذه الكلمة غير موجودة في قائمتك" };
  refresh();
  return { ok: true };
}

function priorSessions(userId: string, completed: number[], partial: PriorPartial | null, today: string) {
  return [
    ...completed.map((surahNumber) => ({ surahNumber, fromAyah: 1, toAyah: AYAH_COUNT[surahNumber] })),
    ...(partial ? [partial] : []),
  ].map(({ surahNumber, fromAyah, toAyah }) => {
    const range = calculatePageRange(surahNumber, fromAyah, toAyah);
    return {
      userId,
      source: "PRIOR" as const,
      type: "NEW" as const,
      surahNumber,
      fromAyah,
      toAyah,
      pagesCalculated: "error" in range ? 0 : range.totalPages,
      day: new Date(`${today}T00:00:00Z`),
    };
  });
}

function cleanPrior(raw: unknown): { completed: number[]; partial: PriorPartial | null } | null {
  const r = raw as { completedSurahs?: unknown; partial?: unknown } | null;
  const completed = Array.isArray(r?.completedSurahs) ? r.completedSurahs.map(Number) : [];
  const p = r?.partial as PriorPartial | null | undefined;
  const partial = p ? { surahNumber: Number(p.surahNumber), fromAyah: Number(p.fromAyah), toAyah: Number(p.toAyah) } : null;
  if (completed.some((n) => !Number.isInteger(n))) return null;
  return { completed, partial };
}

/**
 * Saves her plan. The first time, memorization from before can come with it.
 * Later changes are allowed any time; they stamp planChangedAt (see
 * forPosition in src/lib/rafiq/memorization.ts).
 */
export async function savePlanAction(input: { template: TemplateKey; plan: number[]; prior?: unknown; today: string }): Promise<RafiqResult> {
  const user = await getRafiqUser();
  if (!user) return SIGNED_OUT;
  const planTemplate = TEMPLATE_KEY_PLAN[input?.template];
  if (!planTemplate) return { error: "قالب الخطة غير صحيح" };
  const plan = Array.isArray(input.plan) ? input.plan.map(Number) : [];
  const badPlan = planProblem(plan);
  if (badPlan) return { error: badPlan };

  const current = await getPlan(user.id);
  const firstTime = current.planTemplate === null;

  const prior = firstTime && input.prior ? cleanPrior(input.prior) : { completed: [], partial: null };
  if (!prior) return { error: "بيانات الحفظ السابق غير صحيحة" };
  const badPrior = priorProblem(plan, prior.completed, prior.partial, "خطتك");
  if (badPrior) return { error: badPrior };
  const today = acceptLocalDay(String(input.today ?? ""));
  if (!today) return { error: "يُرجى تحديث الصفحة والمحاولة مرة أخرى" };

  const changed = firstTime || current.planTemplate !== planTemplate || current.plan.join(",") !== plan.join(",");
  if (!changed) return {};

  await prisma.$transaction([
    prisma.rafiqPlanItem.deleteMany({ where: { userId: user.id } }),
    prisma.rafiqPlanItem.createMany({ data: plan.map((surahNumber, position) => ({ userId: user.id, surahNumber, position })) }),
    prisma.rafiqUser.update({ where: { id: user.id }, data: { planTemplate, ...(firstTime ? {} : { planChangedAt: new Date() }) } }),
    ...(firstTime ? [prisma.rafiqSession.createMany({ data: priorSessions(user.id, prior.completed, prior.partial, today) })] : []),
  ]);
  refresh();
  return {};
}

/** Adds memorization from before to an existing plan (whole surahs and/or one part). */
export async function addPriorAction(input: { prior: unknown; today: string }): Promise<RafiqResult> {
  const user = await getRafiqUser();
  if (!user) return SIGNED_OUT;
  const { planTemplate, plan } = await getPlan(user.id);
  if (!planTemplate) return NO_PLAN;
  const prior = cleanPrior(input?.prior);
  if (!prior) return { error: "بيانات الحفظ السابق غير صحيحة" };
  if (prior.completed.length === 0 && !prior.partial) return { error: "يُرجى تحديد سورة واحدة على الأقل" };
  const badPrior = priorProblem(plan, prior.completed, prior.partial, "خطتك");
  if (badPrior) return { error: badPrior };
  const today = acceptLocalDay(String(input.today ?? ""));
  if (!today) return { error: "يُرجى تحديث الصفحة والمحاولة مرة أخرى" };
  await prisma.rafiqSession.createMany({ data: priorSessions(user.id, prior.completed, prior.partial, today) });
  refresh();
  return {};
}
