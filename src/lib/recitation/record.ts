import "server-only";
import type { Prisma } from "@prisma/client";
import {
  advancesPosition,
  calculatePageRange,
  classifyRecitation,
  type Classification,
  type Reach,
  type RecitationSituation,
  type SessionType,
} from "@/lib/recitation/logic";
import type { GroupGender } from "@/lib/text/gender";
import { markSegmentsRecited } from "@/lib/home-log/data";

// The one way a course recitation is saved — by the form on the student's
// page (students/[id]/actions.ts) and by «التسميع بدون إنترنت»
// (lib/offline-sheet) alike — so both classify, store and follow up on a
// session identically.

export type Quality = "EXCELLENT" | "GOOD" | "NEEDS_REPEAT";
export type Mode = "IN_PERSON" | "ONLINE";

export interface EntryClassification {
  situation: RecitationSituation | null;
  requiresReason: boolean;
  // the badge and warning the form shows; null for review/link
  classification: Classification | null;
}

/**
 * Only new memorization goes through gap detection (and may need a
 * reason). A review/link revisits covered material by definition: it gets
 * no situation and can never advance her position (deriveReach ignores
 * it), whatever range it names.
 */
export function classifyEntry(
  plan: number[],
  reach: Reach,
  entry: { type: SessionType; surahNumber: number; fromAyah: number },
  groupGender: GroupGender,
): EntryClassification {
  if (!advancesPosition(entry)) return { situation: null, requiresReason: false, classification: null };
  const classification = classifyRecitation(plan, reach, entry.surahNumber, entry.fromAyah, groupGender);
  return { situation: classification.situation, requiresReason: classification.requiresReason, classification };
}

export interface RecitationInput {
  studentId: string;
  teacherId: string;
  type: SessionType;
  surahNumber: number;
  fromAyah: number;
  toAyah: number;
  quality: Quality;
  mode: Mode;
  situation: RecitationSituation | null;
  // only kept when the entry required one
  reason: string | null;
  notes: string | null;
  occurredAt: Date;
}

/** The session row (pages computed here), or the range's error. */
export function recitationCreateData(
  r: RecitationInput,
): { error: string } | { data: Prisma.RecitationSessionUncheckedCreateInput } {
  const pages = calculatePageRange(r.surahNumber, r.fromAyah, r.toAyah);
  if ("error" in pages) return { error: pages.error };
  return {
    data: {
      studentId: r.studentId,
      teacherId: r.teacherId,
      surahNumber: r.surahNumber,
      fromAyah: r.fromAyah,
      toAyah: r.toAyah,
      pagesCalculated: pages.totalPages,
      quality: r.quality,
      mode: r.mode,
      type: r.type,
      situation: r.situation,
      reason: r.reason,
      notes: r.notes,
      occurredAt: r.occurredAt,
    },
  };
}

/**
 * What follows a saved recitation. Home log (D3): a home segment this
 * recitation covers entirely is marked as recited. One-way only — the home
 * log never feeds the official record.
 */
export async function afterRecitationSaved(r: Pick<RecitationInput, "studentId" | "surahNumber" | "fromAyah" | "toAyah" | "occurredAt">) {
  await markSegmentsRecited(r.studentId, r.surahNumber, r.fromAyah, r.toAyah, r.occurredAt);
}
