import { AYAH_COUNT, SURAH_NAME } from "@/lib/quran-data";
import {
  deriveCurrentPosition,
  deriveReach,
  nextExpectedEntry,
  passedBefore,
  type Classification,
  type NextEntryDefaults,
  type PlanPosition,
  type PositionSession,
  type RecitationSituation,
  type RecitationSubject,
} from "./logic";
import { judgeEntry, memorizedRuns, planCombinedEntry, type CombinedEntry, type EntryContext } from "./combined";
import type { JuzAdoption } from "./juz-direction";

// A second memorization track alongside her plan (course students only):
// e.g. juz 30 by the plan, and Al-Baqarah from its start in parallel.
//
// Memorization is shared: whatever either track memorizes is covered, counts
// everywhere, and is stepped over by the other track's position. What each
// track keeps to itself is its ORDER and its gap approvals — an approved
// gap recorded in one track never moves the other's position (the main
// plan reads second-track sessions with no approval: students/plan.ts,
// forPlanPosition). A track starts at its starting point: everything before
// it in its order counts as passed.
//
//  - «بترتيب المصحف» (MUSHAF): from the starting point forward to An-Nas;
//  - «بالعكس» (REVERSE): from the starting point back to Al-Fatiha, surahs
//    descending and ayat ascending (no juz directions);
//  - «حر» (FREE): no order, no position, no gap check, no pre-fill.
//
// Pure, so the recording form shows exactly what the server and the offline
// sheet will do. «رفيق الحفظ» doesn't use it.

export type TrackKind = "MUSHAF" | "REVERSE" | "FREE";
export type TrackKey = "MAIN" | "SECOND";

export const TRACK_KIND_LABEL: Record<TrackKind, string> = {
  MUSHAF: "بترتيب المصحف",
  REVERSE: "بالعكس",
  FREE: "حر (سور متفرقة)",
};
export const TRACK_LABEL: Record<TrackKey, string> = { MAIN: "الأساسي", SECOND: "الثاني" };

export interface SecondTrack {
  id: string;
  kind: TrackKind;
  startSurah: number | null;
  startAyah: number | null;
}

/** The track's surahs in its order (empty for «حر»). */
export function trackOrder(track: Pick<SecondTrack, "kind" | "startSurah">): number[] {
  const start = track.startSurah ?? 1;
  if (track.kind === "MUSHAF") return Array.from({ length: 115 - start }, (_, i) => start + i);
  if (track.kind === "REVERSE") return Array.from({ length: start }, (_, i) => start - i);
  return [];
}

/** Sessions as one track's position logic sees them: only its own gap approvals count. */
export function sessionsForTrack<T extends { situation?: RecitationSituation | null; trackId: string | null }>(
  sessions: T[],
  trackId: string | null,
): T[] {
  return sessions.map((s) => (s.trackId === trackId ? s : { ...s, situation: null }));
}

/** Where an ordered second track stands (null for «حر»). */
export function trackContext(track: SecondTrack, sessions: (PositionSession & { trackId: string | null })[]): EntryContext | null {
  if (track.kind === "FREE" || !track.startSurah || !track.startAyah) return null;
  const plan = trackOrder(track);
  const reach = passedBefore(plan, deriveReach(plan, sessionsForTrack(sessions, track.id)), track.startSurah, track.startAyah);
  return { plan, reach, directional: null };
}

export interface TrackProgress {
  // the last ayah reached in its order, past its starting point; null before she starts
  position: PlanPosition | null;
  next: NextEntryDefaults | null;
  // every surah of its order memorized: «أتمّ المسار»
  done: boolean;
}

export function trackProgress(track: SecondTrack, ctx: EntryContext): TrackProgress {
  const position = deriveCurrentPosition(ctx.plan, ctx.reach);
  const last = ctx.plan[ctx.plan.length - 1];
  const done = !!position && position.surahNumber === last && position.ayah >= AYAH_COUNT[last];
  // the point just before the start is "passed", not memorized
  const started = !!position && !(position.surahNumber === track.startSurah && position.ayah === (track.startAyah ?? 1) - 1);
  return {
    position: started ? position : null,
    next: done ? null : started ? nextExpectedEntry(ctx.plan, position) : startEntry(track),
    done,
  };
}

function startEntry(track: SecondTrack): NextEntryDefaults {
  const s = track.startSurah!;
  const from = track.startAyah!;
  return { surahNumber: s, fromAyah: from, toAyah: Math.min(from + 14, AYAH_COUNT[s]) };
}

/**
 * «البقرة — الآية 20 من 286», «لم تبدأ بعد — يبدأ المسار من البقرة 11»,
 * «أتمّ المسار»; a «حر» track: «يُحسب كل ما يُحفظ فيه». `notYet` is the
 * group-gendered «لم يبدأ بعد» / «لم تبدأ بعد».
 */
export function trackPositionText(track: SecondTrack, progress: TrackProgress | null, notYet: string): string {
  if (track.kind === "FREE" || !progress) return "يُحسب كل ما يُحفظ فيه";
  if (progress.done) return "أتمّ المسار";
  const p = progress.position;
  if (p) return `${SURAH_NAME[p.surahNumber]} — الآية ${p.ayah} من ${AYAH_COUNT[p.surahNumber]}`;
  return `${notYet} — يبدأ المسار من ${SURAH_NAME[track.startSurah!]} ${track.startAyah}`;
}

/**
 * The track of each surah's latest new memorization (LOGGED, NEW), for the
 * "continuing a surah" rule. Sessions of an ended track count for neither.
 */
export function latestTrackBySurah(
  sessions: { surahNumber: number; type: string; source: string; trackId: string | null; occurredAt: Date | string }[],
  secondId: string | null,
): Partial<Record<number, TrackKey>> {
  const latest: Partial<Record<number, { at: number; track: TrackKey }>> = {};
  for (const s of sessions) {
    if (s.source !== "LOGGED" || s.type !== "NEW") continue;
    const track: TrackKey | null = s.trackId === null ? "MAIN" : s.trackId === secondId ? "SECOND" : null;
    if (!track) continue;
    const at = new Date(s.occurredAt).getTime();
    const prev = latest[s.surahNumber];
    if (!prev || at >= prev.at) latest[s.surahNumber] = { at, track };
  }
  return Object.fromEntries(Object.entries(latest).map(([k, v]) => [k, v!.track]));
}

/**
 * A natural step in this track: «تقدّم طبيعي», or «استكمال» of the surah the
 * track itself stands in. (The gap check calls any entry right after
 * memorized ayat «استكمال», wherever they were memorized; only the track
 * whose position is in that surah is continuing it.)
 */
function naturalIn(ctx: EntryContext, surahNumber: number, fromAyah: number, subject: RecitationSubject): boolean {
  const c = judgeEntry(ctx, surahNumber, fromAyah, subject).classification;
  if (c.situation === "NEXT") return true;
  if (c.situation !== "CONTINUE") return false;
  return deriveCurrentPosition(ctx.plan, ctx.reach)?.surahNumber === surahNumber;
}

/**
 * Which track a «حفظ جديد» entry belongs to, or null when the teacher must
 * choose. Judged from the first ayah not yet memorized (a combined entry's
 * new part):
 *  1. a natural step in exactly one track («تقدّم طبيعي», or «استكمال» of
 *     the surah that track stands in) → it;
 *  2. otherwise, continuing a surah whose latest new memorization belongs
 *     to one track → that track;
 *  3. otherwise → the teacher chooses.
 * A «حر» track is never a natural step, so it is picked automatically only
 * by rule 2. A range all memorized (a re-recording) → rule 2, else the main
 * plan (it moves no position either way).
 */
export function detectTrack(
  main: EntryContext,
  second: EntryContext | null,
  latest: Partial<Record<number, TrackKey>>,
  surahNumber: number,
  fromAyah: number,
  toAyah: number,
  subject: RecitationSubject,
): TrackKey | null {
  const firstNew = memorizedRuns(main.reach.covered[surahNumber], fromAyah, toAyah).find((r) => r.type === "NEW")?.fromAyah;
  if (firstNew === undefined) return latest[surahNumber] ?? "MAIN";
  const inMain = naturalIn(main, surahNumber, firstNew, subject);
  const inSecond = second ? naturalIn(second, surahNumber, firstNew, subject) : false;
  if (inMain !== inSecond) return inMain ? "MAIN" : "SECOND";
  return latest[surahNumber] ?? null;
}

export interface PlannedEntry {
  combo: CombinedEntry | null;
  // the badge and warning to show; null in a «حر» track (no gap check)
  classification: Classification | null;
  // the saved situation of an entry that isn't split
  situation: RecitationSituation | null;
  requiresReason: boolean;
  // a juz direction this entry decides — main plan only
  adopt: JuzAdoption | null;
}

/**
 * A «حفظ جديد» entry as it will be saved in `track`: judged in that track's
 * order (a «حر» track judges nothing), split when it also covers memorized
 * ayat. A range all memorized is a re-recording wherever it is recorded
 * («إعادة تسجيل», with its reason, as before).
 */
export function planEntryInTrack(
  track: TrackKey,
  main: EntryContext,
  second: EntryContext | null,
  surahNumber: number,
  fromAyah: number,
  toAyah: number,
  subject: RecitationSubject,
  reason = "…",
): PlannedEntry {
  const free = track === "SECOND" && !second;
  const ctx = track === "SECOND" && second ? second : main;
  const combo = planCombinedEntry(ctx, surahNumber, fromAyah, toAyah, subject, reason, { free });
  if (combo) {
    return { combo, classification: combo.classification, situation: null, requiresReason: combo.requiresReason, adopt: track === "MAIN" ? combo.adopt : null };
  }
  const allMemorized = memorizedRuns(main.reach.covered[surahNumber], fromAyah, toAyah).every((r) => r.type === "LINK");
  if (free && !allMemorized) return { combo: null, classification: null, situation: null, requiresReason: false, adopt: null };
  const judged = judgeEntry(free ? main : ctx, surahNumber, fromAyah, subject);
  const c = judged.classification;
  return { combo: null, classification: c, situation: c.situation, requiresReason: c.requiresReason, adopt: track === "MAIN" ? judged.adopt : null };
}
