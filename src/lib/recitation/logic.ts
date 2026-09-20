import { AYAH_COUNT, SURAH_NAME, getAyahPageEntries } from "@/lib/quran-data";

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

export type RecitationSituation = "CONTINUE" | "NEXT" | "SURAH_GAP" | "AYAH_GAP" | "EDIT";

export interface FurthestPosition {
  surahNumber: number;
  ayah: number;
}

export interface Classification {
  situation: RecitationSituation;
  requiresReason: boolean;
  badgeVariant: "continue" | "next" | "edit" | "gap";
  badgeText: string;
  warningMessage: string | null;
}

/**
 * Classifies a new recitation entry against the student's plan (spec §5).
 *
 * The prototype compared raw surah numbers and assumed the plan is Mushaf
 * order. Real plans can be reverse-Juz-Amma or fully custom, so this walks
 * the student's actual ordered `plan` (surah numbers by position) instead.
 * `furthest` is the furthest point reached anywhere in the plan so far
 * (by plan position, not simply the most recent session) — reviewing an
 * earlier surah must not move this pointer backward. Same 5 outcomes and
 * messages as the prototype's calc(), generalized to plan position.
 */
export function classifyRecitation(
  plan: number[],
  furthest: FurthestPosition | null,
  newSurah: number,
  newFromAyah: number,
): Classification {
  const newPos = plan.indexOf(newSurah);
  const furthestPos = furthest ? plan.indexOf(furthest.surahNumber) : -1;
  const furthestAyah = furthest?.ayah ?? 0;
  const name = SURAH_NAME[newSurah] ?? `سورة رقم ${newSurah}`;

  if (newPos === -1) {
    return {
      situation: "SURAH_GAP",
      requiresReason: true,
      badgeVariant: "gap",
      badgeText: "⚠️ سورة خارج خطة الطالبة",
      warningMessage: `سورة ${name} ليست ضمن خطة هذه الطالبة الحالية. يُرجى إضافتها إلى الخطة أولًا أو التأكد من اختيار السورة الصحيحة.`,
    };
  }

  // same surah as the furthest point reached
  if (newPos === furthestPos) {
    const expectedFrom = furthestAyah + 1;
    if (newFromAyah > expectedFrom) {
      return {
        situation: "AYAH_GAP",
        requiresReason: true,
        badgeVariant: "gap",
        badgeText: "⚠️ فجوة داخل السورة نفسها",
        warningMessage: `تم تجاوز الآيات من ${expectedFrom} إلى ${newFromAyah - 1} في سورة ${name} دون تسجيلها. يُرجى التأكد إن كان هذا تجاوزًا مقصودًا أم خطأً.`,
      };
    }
    if (newFromAyah <= furthestAyah) {
      return {
        situation: "EDIT",
        requiresReason: true,
        badgeVariant: "edit",
        badgeText: "✏️ إعادة تسجيل لآيات سُمِّعت سابقًا في نفس السورة",
        warningMessage: null,
      };
    }
    return {
      situation: "CONTINUE",
      requiresReason: false,
      badgeVariant: "continue",
      badgeText: "✓ استكمال طبيعي بنفس السورة الحالية",
      warningMessage: null,
    };
  }

  // an earlier surah in the plan than the furthest point reached
  if (newPos < furthestPos) {
    return {
      situation: "EDIT",
      requiresReason: true,
      badgeVariant: "edit",
      badgeText: `✏️ تعديل على سورة سابقة مكتملة (سورة ${name})`,
      warningMessage: null,
    };
  }

  // moving forward to a later surah in the plan
  const prevPos = newPos - 1;
  const prevCompleted =
    prevPos < 0
      ? true
      : furthestPos > prevPos
        ? true
        : furthestPos === prevPos
          ? furthestAyah >= (AYAH_COUNT[plan[prevPos]] ?? Infinity)
          : false;

  if (!prevCompleted) {
    const prevSurahNumber = plan[prevPos];
    const prevName = SURAH_NAME[prevSurahNumber] ?? `سورة رقم ${prevSurahNumber}`;
    const prevTotal = AYAH_COUNT[prevSurahNumber];
    const reachedInPrev = furthestPos === prevPos ? furthestAyah : 0;
    const message =
      furthestPos === prevPos
        ? `لم تكتمل سورة ${prevName} بعد — وصلت الطالبة إلى الآية ${reachedInPrev} من أصل ${prevTotal}. يُرجى التأكد قبل تسجيل سورة ${name}.`
        : `سورة ${prevName} (السابقة لسورة ${name} في الخطة) لم يُسجَّل فيها أي تقدّم بعد (${reachedInPrev} من ${prevTotal} آية). يُرجى التأكد إن كان هذا تجاوزًا مقصودًا أم خطأً.`;
    return {
      situation: "SURAH_GAP",
      requiresReason: true,
      badgeVariant: "gap",
      badgeText: "⚠️ فجوة في الخطة قبل هذه السورة",
      warningMessage: message,
    };
  }

  const expectedFrom = 1;
  if (newFromAyah > expectedFrom) {
    return {
      situation: "AYAH_GAP",
      requiresReason: true,
      badgeVariant: "gap",
      badgeText: "⚠️ فجوة داخل هذه السورة",
      warningMessage: `تم تجاوز الآيات من ${expectedFrom} إلى ${newFromAyah - 1} في سورة ${name} دون تسجيلها. يُرجى التأكد إن كان هذا تجاوزًا مقصودًا أم خطأً.`,
    };
  }

  return {
    situation: "NEXT",
    requiresReason: false,
    badgeVariant: "next",
    badgeText: "✓ تقدّم طبيعي للسورة التالية بالخطة",
    warningMessage: null,
  };
}

/**
 * The furthest point reached anywhere in the student's plan, derived from
 * all of her recitation sessions (not just the most recent one — an "edit"
 * session that reviews an earlier surah must not move this backward).
 */
export function deriveFurthestPosition(
  plan: number[],
  sessions: { surahNumber: number; toAyah: number }[],
): FurthestPosition | null {
  let best: { pos: number; ayah: number; surahNumber: number } | null = null;
  for (const s of sessions) {
    const pos = plan.indexOf(s.surahNumber);
    if (pos === -1) continue;
    if (!best || pos > best.pos || (pos === best.pos && s.toAyah > best.ayah)) {
      best = { pos, ayah: s.toAyah, surahNumber: s.surahNumber };
    }
  }
  return best ? { surahNumber: best.surahNumber, ayah: best.ayah } : null;
}
