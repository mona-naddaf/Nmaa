"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { childActing, resolveSubject } from "@/lib/rafiq/subject";
import { getRafiqTargets } from "@/lib/rafiq/home-log";
import { resolveRafiqHomeSpot, setRafiqHomeSpot, setRafiqMark } from "@/lib/rafiq/home-mistakes";
import { rafiqTajweedOn } from "@/lib/rafiq/tajweed";
import { checkDetail, validateDetails } from "@/lib/tajweed/validate";
import { isValidSpot } from "@/lib/tajweed/spots";
import type { TajweedKind } from "@/lib/tajweed/taxonomy";
import { checkMark, type MarkInput } from "@/lib/home-log/self-marks";
import { acceptLocalDay, HOME_LIMITS, HOME_TAP_KINDS, validateRange, validateTargets, type HomeTapKind, type HomeTargets } from "@/lib/home-log/rules";

// Her «حفظي في البيت». The same rules and limits as a course student's
// (src/lib/home-log/rules.ts). Every action resolves whose home log it is
// (src/lib/rafiq/subject.ts) and checks the passage is theirs. Nothing here
// touches her sessions or position.

export type HomeResult = { error?: string; id?: string };

// «العائلة»: a child's «حفظي في البيت» and her own marks there follow the
// switches the adults set (always on for an adult's own data)
const HOME_OFF = { error: "«حفظي في البيت» غير مفعّل" };
const MARKS_OFF = { error: "تحديد الأخطاء في البيت غير مفعّل" };

function ownActiveSegment(uid: string, segmentId: string) {
  return prisma.rafiqHomeSegment.findFirst({
    where: { id: String(segmentId ?? ""), userId: uid, finishedAt: null },
    select: { id: true, fromAyah: true, toAyah: true },
  });
}

function refresh() {
  revalidatePath("/rafiq/home-log", "layout");
}

export async function createSegmentAction(input: { surahNumber: number; fromAyah: number; toAyah: number; subjectId?: string }): Promise<HomeResult> {
  const s = await resolveSubject(input?.subjectId, "record");
  if ("error" in s) return s;
  if (!s.features.homeLog) return HOME_OFF;
  const uid = s.id;
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

// subjectId: «العائلة», a child's id when an adult practises with the child
type TapInput = { segmentId: string; ayah: number | null; kind: HomeTapKind; day: string; subjectId?: string };

/** One "+" tap: a whole-passage counter (ayah null) or one ayah's counter. */
export async function tapAction(input: TapInput): Promise<HomeResult> {
  const s = await resolveSubject(input?.subjectId, "record");
  if ("error" in s) return s;
  if (!s.features.homeLog) return HOME_OFF;
  const uid = s.id;
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
  const s = await resolveSubject(input?.subjectId, "record");
  if ("error" in s) return s;
  if (!s.features.homeLog) return HOME_OFF;
  const uid = s.id;
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

export async function finishSegmentAction(segmentId: string, subjectId?: string): Promise<HomeResult> {
  const s = await resolveSubject(subjectId, "record");
  if ("error" in s) return s;
  if (!s.features.homeLog) return HOME_OFF;
  const uid = s.id;
  const { count } = await prisma.rafiqHomeSegment.updateMany({
    where: { id: String(segmentId ?? ""), userId: uid, finishedAt: null },
    data: { finishedAt: new Date() },
  });
  if (count === 0) return { error: "هذا المقطع غير متاح" };
  refresh();
  return {};
}

/** Only a passage with no taps yet (a mistaken range) can be deleted. */
export async function deleteSegmentAction(segmentId: string, subjectId?: string): Promise<HomeResult> {
  const s = await resolveSubject(subjectId, "record");
  if ("error" in s) return s;
  if (!s.features.homeLog) return HOME_OFF;
  const uid = s.id;
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
export async function setTargetsAction(input: HomeTargets, subjectId?: string): Promise<HomeResult & { targets?: HomeTargets }> {
  const s = await resolveSubject(subjectId, "manage");
  if ("error" in s) return s;
  if (!s.features.homeLog) return HOME_OFF;
  const uid = s.id;
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
  // what was saved, so her targets line shows it before the page refreshes
  return { targets: t };
}

/** Marks, re-types or removes (type null) one word of an active passage of hers. */
export async function markWordAction(input: MarkInput, subjectId?: string): Promise<HomeResult> {
  const s = await resolveSubject(subjectId, "record");
  if ("error" in s) return s;
  if (!s.features.homeLog) return HOME_OFF;
  if (childActing(s) && !s.features.homeMistakes) return MARKS_OFF;
  const uid = s.id;
  const segment = await prisma.rafiqHomeSegment.findFirst({
    where: { id: String(input?.segmentId ?? ""), userId: uid, finishedAt: null },
    select: { surahNumber: true, fromAyah: true, toAyah: true },
  });
  if (!segment) return { error: "هذا المقطع غير متاح" };
  const mark = checkMark(segment, input);
  if ("error" in mark) return { error: mark.error };
  return setRafiqMark(uid, segment.surahNumber, mark);
}

// ---------- her detailed tajweed marks (lib/tajweed) ----------

/**
 * Her marks on one letter or gap of an active passage of hers become
 * exactly `errors`. Only while her «أخطاء التجويد المفصّلة» setting is on.
 */
export async function markSpotAction(input: {
  segmentId: string;
  ayah: number;
  wordPosition: number;
  letter: number;
  gapAfter: boolean;
  errors: { kind: TajweedKind; code: string; confusedWith: string | null }[];
  subjectId?: string;
}): Promise<HomeResult> {
  const s = await resolveSubject(input?.subjectId, "record");
  if ("error" in s) return s;
  if (!s.features.homeLog) return HOME_OFF;
  if (childActing(s) && !s.features.homeMistakes) return MARKS_OFF;
  const uid = s.id;
  if (!(await rafiqTajweedOn(uid))) return { error: "أخطاء التجويد المفصّلة غير مفعّلة في إعداداتك" };
  const segment = await prisma.rafiqHomeSegment.findFirst({
    where: { id: String(input?.segmentId ?? ""), userId: uid, finishedAt: null },
    select: { surahNumber: true, fromAyah: true, toAyah: true },
  });
  if (!segment) return { error: "هذا المقطع غير متاح" };
  const spot = { ayah: input?.ayah, wordPosition: input?.wordPosition, letter: input?.letter ?? 0, gapAfter: input?.gapAfter === true };
  // the spot itself (also when nothing is left on it)
  const base = checkDetail({ ...spot, kind: "HUKM", code: "", confusedWith: null }, segment.surahNumber, segment.fromAyah, segment.toAyah);
  if (!base) return { error: "حرف أو موضع خارج المقطع" };
  const errors = Array.isArray(input?.errors) ? input.errors : [];
  const checked = validateDetails(
    errors.map((e) => ({ ...spot, kind: e?.kind, code: e?.code, confusedWith: e?.confusedWith ?? null })),
    segment.surahNumber,
    segment.fromAyah,
    segment.toAyah,
  );
  if ("error" in checked) return { error: checked.error };
  const r = await setRafiqHomeSpot(uid, segment.surahNumber, base, checked.details);
  if (!r.error) refresh();
  return r;
}

/** «تم الإتقان» from her practice screen: every open detailed mark on one letter or gap. */
export async function resolveSpotAction(input: {
  surahNumber: number;
  ayah: number;
  wordPosition: number;
  letter: number;
  gapAfter: boolean;
  subjectId?: string;
}): Promise<{ error: string } | { ok: true }> {
  const s = await resolveSubject(input?.subjectId, "record");
  if ("error" in s) return s;
  if (!s.features.homeLog) return HOME_OFF;
  if (childActing(s) && !s.features.homeMistakes) return MARKS_OFF;
  // as on her page: a child's marks are resolved by an adult with edit rights
  if (childActing(s)) return { error: "يؤشّر أهلك على الكلمات بعد إتقانها" };
  const uid = s.id;
  const spot = { letter: Number(input?.letter ?? 0), gapAfter: input?.gapAfter === true };
  if (!isValidSpot(spot) || (spot.letter === 0 && !spot.gapAfter)) return { error: "بيانات غير صحيحة" };
  const done = await resolveRafiqHomeSpot(uid, Number(input?.surahNumber), Number(input?.ayah), Number(input?.wordPosition), spot);
  if (!done) return { error: "هذا الخطأ غير موجود في قائمتك" };
  refresh();
  return { ok: true };
}
