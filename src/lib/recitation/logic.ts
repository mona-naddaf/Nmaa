import { AYAH_COUNT, SURAH_NAME, getAyahPageEntries } from "@/lib/quran-data";
import { pickByGroup, pickByPerson, studentNounDef, thisDemonstrative, type GroupGender, type PersonGender } from "@/lib/text/gender";

export interface PageRangeResult {
  totalPages: number;
  minPage: number;
  maxPage: number;
}

export type PageRangeError = { error: string };

// Sums the precomputed per-ayah page fractions for [fromAyah, toAyah] of a
// surah. Ported 1:1 from the bloomtrack-app.html prototype's calc() — this is
// the exact logic verified against the spec's worked examples (Kahf 25-40 =
// 1.846 pages, Qaf 1-15 = 1 page).
export function calculatePageRange(
  surahNumber: number,
  fromAyah: number,
  toAyah: number,
): PageRangeResult | PageRangeError {
  const entries = getAyahPageEntries(surahNumber);
  const ayahCount = AYAH_COUNT[surahNumber];
  if (
    !entries ||
    !Number.isFinite(fromAyah) ||
    !Number.isFinite(toAyah) ||
    fromAyah < 1 ||
    toAyah > entries.length ||
    fromAyah > toAyah
  ) {
    return {
      error: `يُرجى التأكد من أرقام الآيات (تحتوي السورة على ${ayahCount ?? "؟"} آية)`,
    };
  }

  let totalFrac = 0;
  let minPage = Infinity;
  let maxPage = 0;
  for (let a = fromAyah; a <= toAyah; a++) {
    const [frac, pStart, pEnd] = entries[a - 1];
    totalFrac += frac;
    if (pStart < minPage) minPage = pStart;
    if (pEnd > maxPage) maxPage = pEnd;
  }

  return {
    totalPages: Math.round(totalFrac * 1000) / 1000,
    minPage,
    maxPage,
  };
}

export type SessionType = "NEW" | "REVIEW" | "LINK";

/**
 * Whether a session moves the student forward. Only new memorization does
 * (PRIOR baselines are stored as NEW); REVIEW/LINK revisit covered material
 * and must never advance her position or coverage, whatever range they name.
 */
export function advancesPosition(session: { type: SessionType }): boolean {
  return session.type === "NEW";
}

export type RecitationSituation = "CONTINUE" | "NEXT" | "SURAH_GAP" | "AYAH_GAP" | "EDIT";

export interface PlanPosition {
  surahNumber: number;
  ayah: number;
}

// ---------- reach: what the student has covered or consciously passed ----------

/**
 * Everything position and gap detection need to know about a student's
 * progress, in a serializable form so the recitation form can classify
 * entries client-side exactly like the server does:
 *  - `covered`: per surah, the sorted/merged ayah ranges recited in NEW
 *    sessions (PRIOR baselines are NEW). REVIEW/LINK never count.
 *  - `passedThrough`: the latest point in plan order that an approved gap
 *    skipped over. A NEW session saved as SURAH_GAP/AYAH_GAP with a reason
 *    means a teacher consciously approved skipping to it, so everything in
 *    the plan before its start counts as passed for position purposes —
 *    permanently, not just for that one entry. Passed ayat are NOT covered:
 *    recording them later is filling the skip, not a re-recording.
 */
export interface Reach {
  covered: Record<number, [number, number][]>;
  passedThrough: PlanPosition | null;
}

export interface PositionSession {
  surahNumber: number;
  fromAyah: number;
  toAyah: number;
  type: SessionType;
  situation?: RecitationSituation | null;
  reason?: string | null;
}

export function deriveReach(plan: number[], sessions: PositionSession[]): Reach {
  return sessions.reduce((reach, s) => withSession(plan, reach, s), { covered: {}, passedThrough: null } as Reach);
}

/** `reach` plus one more session (also used for an entry just saved in the form). */
export function withSession(plan: number[], reach: Reach, s: PositionSession): Reach {
  if (!advancesPosition(s)) return reach;
  let next = withCoveredRange(reach, s.surahNumber, s.fromAyah, s.toAyah);
  if ((s.situation === "SURAH_GAP" || s.situation === "AYAH_GAP") && s.reason?.trim()) {
    const before = pointBefore(plan, s.surahNumber, s.fromAyah);
    if (before && (!next.passedThrough || comparePlanPoints(plan, before, next.passedThrough) > 0)) {
      next = { ...next, passedThrough: before };
    }
  }
  return next;
}

function withCoveredRange(reach: Reach, surahNumber: number, fromAyah: number, toAyah: number): Reach {
  const count = AYAH_COUNT[surahNumber];
  if (!count) return reach;
  const from = Math.max(1, fromAyah);
  const to = Math.min(count, toAyah);
  if (from > to) return reach;
  const merged: [number, number][] = [];
  for (const [a, b] of [...(reach.covered[surahNumber] ?? []), [from, to] as [number, number]].sort((x, y) => x[0] - y[0])) {
    const last = merged[merged.length - 1];
    if (last && a <= last[1] + 1) last[1] = Math.max(last[1], b);
    else merged.push([a, b]);
  }
  return { ...reach, covered: { ...reach.covered, [surahNumber]: merged } };
}

function isCovered(reach: Reach, surahNumber: number, ayah: number): boolean {
  return (reach.covered[surahNumber] ?? []).some(([a, b]) => ayah >= a && ayah <= b);
}

/** Covered, or at/before the point approved gaps have passed through. */
function isReached(plan: number[], reach: Reach, surahNumber: number, ayah: number): boolean {
  if (isCovered(reach, surahNumber, ayah)) return true;
  const passed = reach.passedThrough;
  return !!passed && comparePlanPoints(plan, { surahNumber, ayah }, passed) <= 0;
}

/** Last ayah of `surahNumber` reached contiguously from ayah 1 (0 if none). */
function reachedFromStart(plan: number[], reach: Reach, surahNumber: number): number {
  const count = AYAH_COUNT[surahNumber] ?? 0;
  let a = 0;
  while (a < count && isReached(plan, reach, surahNumber, a + 1)) a++;
  return a;
}

function comparePlanPoints(plan: number[], x: PlanPosition, y: PlanPosition): number {
  const dx = plan.indexOf(x.surahNumber);
  const dy = plan.indexOf(y.surahNumber);
  return dx !== dy ? dx - dy : x.ayah - y.ayah;
}

/** The point just before (surah, ayah) in plan order; null at the very start or outside the plan. */
function pointBefore(plan: number[], surahNumber: number, ayah: number): PlanPosition | null {
  const pos = plan.indexOf(surahNumber);
  if (pos === -1) return null;
  if (ayah > 1) return { surahNumber, ayah: ayah - 1 };
  if (pos === 0) return null;
  const prev = plan[pos - 1];
  return { surahNumber: prev, ayah: AYAH_COUNT[prev] };
}

// ---------- current position ----------

/**
 * The student's current position: walking her plan in order, the last ayah
 * reached before the first one that isn't — i.e. where she continues from.
 * Not the furthest surah she has touched: surahs covered further ahead (e.g.
 * scattered prior memorization) are simply stepped over once she reaches
 * them. null when nothing at the start of the plan is reached yet; the last
 * ayah of the plan once all of it is (khatm).
 */
export function deriveCurrentPosition(plan: number[], reach: Reach): PlanPosition | null {
  let last: PlanPosition | null = null;
  for (const surahNumber of plan) {
    const count = AYAH_COUNT[surahNumber] ?? 0;
    const reached = reachedFromStart(plan, reach, surahNumber);
    if (reached > 0) last = { surahNumber, ayah: reached };
    if (reached < count) break;
  }
  return last;
}

// ---------- gap detection ----------

export interface Classification {
  situation: RecitationSituation;
  requiresReason: boolean;
  badgeVariant: "continue" | "next" | "edit" | "gap";
  badgeText: string;
  warningMessage: string | null;
}

/**
 * Whose plan the messages talk about: a course student, described in the
 * third person by her group's gender (the default), or the learner herself
 * in «رفيق الحفظ», addressed in the second person by her own gender.
 */
export type RecitationSubject = GroupGender | { self: PersonGender };

function subjectWords(subject: RecitationSubject) {
  if (typeof subject === "object") {
    return {
      plan: "خطتك",
      thisPlan: "خطتك",
      reached: pickByPerson(subject.self, { m: "وصلتَ", f: "وصلتِ" }),
    };
  }
  const studentDef = studentNounDef(subject);
  return {
    plan: `خطة ${studentDef}`,
    thisPlan: `خطة ${thisDemonstrative(subject)} ${studentDef}`,
    reached: `${pickByGroup(subject, { m: "وصل", f: "وصلت" })} ${studentDef}`,
  };
}

/**
 * Classifies a new-memorization entry against the student's plan (spec §5):
 * same 5 outcomes and messages as the prototype's calc(), but judged locally
 * — by whether the ayah right before the entry (in plan order) is reached —
 * rather than against a single "furthest" pointer, so covered material
 * further ahead never makes a natural continuation look like an edit, and a
 * surah already covered ahead is recognised as done rather than as a gap.
 */
export function classifyRecitation(
  plan: number[],
  reach: Reach,
  newSurah: number,
  newFromAyah: number,
  subject: RecitationSubject = "MIXED",
): Classification {
  const newPos = plan.indexOf(newSurah);
  const name = SURAH_NAME[newSurah] ?? `سورة رقم ${newSurah}`;
  const words = subjectWords(subject);

  if (newPos === -1) {
    return {
      situation: "SURAH_GAP",
      requiresReason: true,
      badgeVariant: "gap",
      badgeText: `⚠️ سورة خارج ${words.plan}`,
      warningMessage: `سورة ${name} ليست ضمن ${words.thisPlan} الحالية. يُرجى إضافتها إلى الخطة أولًا أو التأكد من اختيار السورة الصحيحة.`,
    };
  }

  // starts on an ayah she has already recited: a re-recording
  if (isCovered(reach, newSurah, newFromAyah)) {
    const surahComplete = reachedFromStart(plan, { covered: reach.covered, passedThrough: null }, newSurah) >= AYAH_COUNT[newSurah];
    return {
      situation: "EDIT",
      requiresReason: true,
      badgeVariant: "edit",
      badgeText: surahComplete
        ? `✏️ تعديل على سورة مكتملة سابقًا (سورة ${name})`
        : "✏️ إعادة تسجيل لآيات سُمِّعت سابقًا في نفس السورة",
      warningMessage: null,
    };
  }

  // the nearest reached ayah before the entry within the same surah
  let lastReachedBefore = newFromAyah - 1;
  while (lastReachedBefore >= 1 && !isReached(plan, reach, newSurah, lastReachedBefore)) lastReachedBefore--;

  if (lastReachedBefore === newFromAyah - 1 && newFromAyah > 1) {
    return {
      situation: "CONTINUE",
      requiresReason: false,
      badgeVariant: "continue",
      badgeText: "✓ استكمال طبيعي بنفس السورة الحالية",
      warningMessage: null,
    };
  }

  if (lastReachedBefore === 0) {
    // nothing reached in this surah before the entry: the previous surah in
    // the plan must be complete for this to be a natural next step
    const prevPos = newPos - 1;
    const prevSurah = prevPos >= 0 ? plan[prevPos] : null;
    const prevTotal = prevSurah ? AYAH_COUNT[prevSurah] : 0;
    const reachedInPrev = prevSurah ? reachedFromStart(plan, reach, prevSurah) : 0;
    if (prevSurah && reachedInPrev < prevTotal) {
      const prevName = SURAH_NAME[prevSurah] ?? `سورة رقم ${prevSurah}`;
      return {
        situation: "SURAH_GAP",
        requiresReason: true,
        badgeVariant: "gap",
        badgeText: "⚠️ فجوة في الخطة قبل هذه السورة",
        warningMessage:
          reachedInPrev > 0
            ? `لم تكتمل سورة ${prevName} بعد — ${words.reached} إلى الآية ${reachedInPrev} من أصل ${prevTotal}. يُرجى التأكد قبل تسجيل سورة ${name}.`
            : `سورة ${prevName} (السابقة لسورة ${name} في الخطة) لم يُسجَّل فيها أي تقدّم بعد (0 من ${prevTotal} آية). يُرجى التأكد إن كان هذا تجاوزًا مقصودًا أم خطأً.`,
      };
    }
    if (newFromAyah === 1) {
      return {
        situation: "NEXT",
        requiresReason: false,
        badgeVariant: "next",
        badgeText: "✓ تقدّم طبيعي للسورة التالية بالخطة",
        warningMessage: null,
      };
    }
  }

  const expectedFrom = lastReachedBefore + 1;
  return {
    situation: "AYAH_GAP",
    requiresReason: true,
    badgeVariant: "gap",
    badgeText: lastReachedBefore > 0 ? "⚠️ فجوة داخل السورة نفسها" : "⚠️ فجوة داخل هذه السورة",
    warningMessage: `تم تجاوز الآيات من ${expectedFrom} إلى ${newFromAyah - 1} في سورة ${name} دون تسجيلها. يُرجى التأكد إن كان هذا تجاوزًا مقصودًا أم خطأً.`,
  };
}

export interface NextEntryDefaults {
  surahNumber: number;
  fromAyah: number;
  toAyah: number;
}

/**
 * A sensible default next entry to pre-fill the recitation form with: right
 * after the current position, rolling over to the next surah in the plan
 * when the current one is already complete. Caps the range at 15 ayat,
 * matching the prototype's default window.
 */
export function nextExpectedEntry(plan: number[], position: PlanPosition | null): NextEntryDefaults {
  if (!position) {
    const surahNumber = plan[0] ?? 1;
    return { surahNumber, fromAyah: 1, toAyah: Math.min(15, AYAH_COUNT[surahNumber] ?? 1) };
  }

  const ayahCount = AYAH_COUNT[position.surahNumber] ?? position.ayah;
  if (position.ayah < ayahCount) {
    const fromAyah = position.ayah + 1;
    return { surahNumber: position.surahNumber, fromAyah, toAyah: Math.min(fromAyah + 14, ayahCount) };
  }

  const pos = plan.indexOf(position.surahNumber);
  const nextSurah = pos >= 0 ? plan[pos + 1] : undefined;
  if (nextSurah) {
    return { surahNumber: nextSurah, fromAyah: 1, toAyah: Math.min(15, AYAH_COUNT[nextSurah]) };
  }

  // plan fully complete (khatm) — leave pointed at the last ayah of the last surah
  return { surahNumber: position.surahNumber, fromAyah: position.ayah, toAyah: position.ayah };
}
