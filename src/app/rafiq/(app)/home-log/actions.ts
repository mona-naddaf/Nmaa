"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getRafiqUser } from "@/lib/rafiq/session";
import { getRafiqTargets } from "@/lib/rafiq/home-log";
import { setRafiqMark } from "@/lib/rafiq/home-mistakes";
import { checkMark, type MarkInput } from "@/lib/home-log/self-marks";
import { acceptLocalDay, HOME_LIMITS, HOME_TAP_KINDS, validateRange, validateTargets, type HomeTapKind, type HomeTargets } from "@/lib/home-log/rules";

// Her «حفظي في البيت». The same rules and limits as a course student's
// (src/lib/home-log/rules.ts). Every action re-checks her session and that
// the passage is hers. Nothing here touches her sessions or position.

export type HomeResult = { error?: string; id?: string };

const SIGNED_OUT = { error: "انتهت الجلسة، يُرجى تسجيل الدخول مرة أخرى" };

async function userId() {
  return (await getRafiqUser())?.id ?? null;
}

function ownActiveSegment(uid: string, segmentId: string) {
  return prisma.rafiqHomeSegment.findFirst({
    where: { id: String(segmentId ?? ""), userId: uid, finishedAt: null },
    select: { id: true, fromAyah: true, toAyah: true },
  });
}

function refresh() {
  revalidatePath("/rafiq/home-log", "layout");
}

export async function createSegmentAction(input: { surahNumber: number; fromAyah: number; toAyah: number }): Promise<HomeResult> {
  const uid = await userId();
  if (!uid) return SIGNED_OUT;
  const surahNumber = Number(input?.surahNumber);
  const fromAyah = Number(input?.fromAyah);
  const toAyah = Number(input?.toAyah);
  const bad = validateRange(surahNumber, fromAyah, toAyah);
  if (bad) return { error: bad };

  const [active, recent] = await Promise.all([
    prisma.rafiqHomeSegment.count({ where: { userId: uid, finishedAt: null } }),
    prisma.rafiqHomeSegment.count({ where: { userId: uid, createdAt: { gt: new Date(Date.now() - 24 * 60 * 60 * 1000) } } }),
  ]);
  if (active >= HOME_LIMITS.maxActiveSegments) {
    return { error: `يمكن أن تكون ${HOME_LIMITS.maxActiveSegments} مقاطع على الأكثر قيد الحفظ في وقت واحد — يُرجى إتمام أحدها أولًا` };
  }
  if (recent >= HOME_LIMITS.segmentsPerDay) return { error: "تم بلوغ الحدّ اليومي لإضافة المقاطع، ويمكن الإضافة مجددًا غدًا" };

  const t = await getRafiqTargets(uid);
  const segment = await prisma.rafiqHomeSegment.create({
    data: { userId: uid, surahNumber, fromAyah, toAyah, targetListen: t.listen, targetRepeat: t.repeat, targetRecite: t.recite },
    select: { id: true },
  });
  refresh();
  return { id: segment.id };
}

type TapInput = { segmentId: string; ayah: number | null; kind: HomeTapKind; day: string };

/** One "+" tap: a whole-passage counter (ayah null) or one ayah's counter. */
export async function tapAction(input: TapInput): Promise<HomeResult> {
  const uid = await userId();
  if (!uid) return SIGNED_OUT;
  if (!HOME_TAP_KINDS.includes(input?.kind)) return { error: "نوع غير صحيح" };
  const day = acceptLocalDay(input?.day);
  if (!day) return { error: "تاريخ غير صحيح — يُرجى تحديث الصفحة" };
  const segment = await ownActiveSegment(uid, input?.segmentId);
  if (!segment) return { error: "هذا المقطع غير متاح للتسجيل" };
  const ayah = input?.ayah ?? null;
  if (ayah !== null && (!Number.isInteger(ayah) || ayah < segment.fromAyah || ayah > segment.toAyah)) {
    return { error: "آية خارج المقطع" };
  }
  const recent = await prisma.rafiqHomeTap.count({ where: { userId: uid, createdAt: { gt: new Date(Date.now() - 60 * 1000) } } });
  if (recent >= HOME_LIMITS.tapsPerMinute) return { error: "ضغطات كثيرة في وقت قصير — يُرجى التمهّل قليلًا" };
  await prisma.rafiqHomeTap.create({ data: { segmentId: segment.id, userId: uid, ayah, kind: input.kind, day: new Date(`${day}T00:00:00Z`) } });
  return {};
}

/** Removes her most recent tap of that counter, from today only. */
export async function undoTapAction(input: TapInput): Promise<HomeResult> {
  const uid = await userId();
  if (!uid) return SIGNED_OUT;
  if (!HOME_TAP_KINDS.includes(input?.kind)) return { error: "نوع غير صحيح" };
  const day = acceptLocalDay(input?.day);
  if (!day) return { error: "تاريخ غير صحيح — يُرجى تحديث الصفحة" };
  const segment = await ownActiveSegment(uid, input?.segmentId);
  if (!segment) return { error: "هذا المقطع غير متاح للتسجيل" };
  const last = await prisma.rafiqHomeTap.findFirst({
    where: { segmentId: segment.id, userId: uid, ayah: input?.ayah ?? null, kind: input.kind, day: new Date(`${day}T00:00:00Z`) },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });
  if (!last) return { error: "لا يوجد ما يمكن التراجع عنه اليوم" };
  await prisma.rafiqHomeTap.delete({ where: { id: last.id } });
  return {};
}

export async function finishSegmentAction(segmentId: string): Promise<HomeResult> {
  const uid = await userId();
  if (!uid) return SIGNED_OUT;
  const { count } = await prisma.rafiqHomeSegment.updateMany({
    where: { id: String(segmentId ?? ""), userId: uid, finishedAt: null },
    data: { finishedAt: new Date() },
  });
  if (count === 0) return { error: "هذا المقطع غير متاح" };
  refresh();
  return {};
}

/** Only a passage with no taps yet (a mistaken range) can be deleted. */
export async function deleteSegmentAction(segmentId: string): Promise<HomeResult> {
  const uid = await userId();
  if (!uid) return SIGNED_OUT;
  const segment = await prisma.rafiqHomeSegment.findFirst({
    where: { id: String(segmentId ?? ""), userId: uid },
    select: { id: true, _count: { select: { taps: true } } },
  });
  if (!segment) return { error: "هذا المقطع غير متاح" };
  if (segment._count.taps > 0) return { error: "لا يمكن حذف مقطع سُجّل فيه تدريب — يمكن إتمامه بدلًا من ذلك" };
  await prisma.rafiqHomeSegment.delete({ where: { id: segment.id } });
  refresh();
  return {};
}

/** Her own targets: for new passages, and her active ones too. */
export async function setTargetsAction(input: HomeTargets): Promise<HomeResult> {
  const uid = await userId();
  if (!uid) return SIGNED_OUT;
  const t = validateTargets(input);
  if (!t) return { error: `يُرجى إدخال أهداف بين ${HOME_LIMITS.targetMin} و${HOME_LIMITS.targetMax}` };
  await prisma.$transaction([
    prisma.rafiqUser.update({ where: { id: uid }, data: { homeTargetListen: t.listen, homeTargetRepeat: t.repeat, homeTargetRecite: t.recite } }),
    prisma.rafiqHomeSegment.updateMany({
      where: { userId: uid, finishedAt: null },
      data: { targetListen: t.listen, targetRepeat: t.repeat, targetRecite: t.recite },
    }),
  ]);
  refresh();
  return {};
}

/** Marks, re-types or removes (type null) one word of an active passage of hers. */
export async function markWordAction(input: MarkInput): Promise<HomeResult> {
  const uid = await userId();
  if (!uid) return SIGNED_OUT;
  const segment = await prisma.rafiqHomeSegment.findFirst({
    where: { id: String(input?.segmentId ?? ""), userId: uid, finishedAt: null },
    select: { surahNumber: true, fromAyah: true, toAyah: true },
  });
  if (!segment) return { error: "هذا المقطع غير متاح" };
  const mark = checkMark(segment, input);
  if ("error" in mark) return { error: mark.error };
  return setRafiqMark(uid, segment.surahNumber, mark);
}
