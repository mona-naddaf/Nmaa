import {
  classifyRecitation,
  deriveReach,
  withSession,
  type Classification,
  type PositionSession,
  type Reach,
  type RecitationSituation,
  type RecitationSubject,
} from "./logic";
import { classifyWithDirections, reverseOrder, type JuzAdoption, type JuzDirections } from "./juz-direction";

// One «حفظ جديد» entry that also covers ayat she has already memorized
// (e.g. she had 1–10, memorized 11–20 today and recited 1–20 in one go) is
// saved as several rows sharing a comboId: the ayat not yet memorized as
// new memorization, the memorized ones as «ربط». Only the new parts move
// her position and go through the gap check. One rating for the whole
// entry; shown and counted as one entry everywhere.
//
// Pure, so the recording form shows exactly what the server (and the
// offline sheet) will save. Course students only — «رفيق الحفظ» doesn't
// use it.

export type PartType = "NEW" | "LINK";

export interface EntryPart {
  type: PartType;
  fromAyah: number;
  toAyah: number;
}

/**
 * The range in reading order, cut into runs of memorized ayat (LINK) and
 * the rest (NEW). `covered` is her memorized ayat in this surah — new
 * memorization and prior memorization (Reach.covered); ayat an approved gap
 * passed over were never memorized, so they count as new.
 */
export function memorizedRuns(covered: [number, number][] | undefined, fromAyah: number, toAyah: number): EntryPart[] {
  const isCovered = (a: number) => (covered ?? []).some(([x, y]) => a >= x && a <= y);
  const runs: EntryPart[] = [];
  for (let a = fromAyah; a <= toAyah; a++) {
    const type: PartType = isCovered(a) ? "LINK" : "NEW";
    const last = runs[runs.length - 1];
    if (last && last.type === type) last.toAyah = a;
    else runs.push({ type, fromAyah: a, toAyah: a });
  }
  return runs;
}

/** Where position logic stands for this student (form, server and sheet alike). */
export interface EntryContext {
  plan: number[];
  reach: Reach;
  // an untouched reverse plan: its juz directions and the sessions as position logic sees them
  directional: { directions: JuzDirections; sessions: PositionSession[] } | null;
}

export function entryContext(plan: number[], directions: JuzDirections | null, sessions: PositionSession[]): EntryContext {
  return { plan, reach: deriveReach(plan, sessions), directional: directions ? { directions, sessions } : null };
}

/** A new-memorization entry judged where it stands (juz directions included). */
export function judgeEntry(ctx: EntryContext, surahNumber: number, fromAyah: number, subject: RecitationSubject) {
  return ctx.directional
    ? classifyWithDirections(ctx.directional.directions, ctx.directional.sessions, surahNumber, fromAyah, subject)
    : { classification: classifyRecitation(ctx.plan, ctx.reach, surahNumber, fromAyah, subject), adopt: null };
}

/** The context once `saved` is recorded (and `adopt` decided, if any). */
export function withSaved(ctx: EntryContext, saved: PositionSession, adopt: JuzAdoption | null): EntryContext {
  if (!ctx.directional) return { ...ctx, reach: withSession(ctx.plan, ctx.reach, saved) };
  const directions = adopt ? { ...ctx.directional.directions, [adopt.juz]: adopt.direction } : ctx.directional.directions;
  const sessions = [...ctx.directional.sessions, saved];
  const plan = adopt ? reverseOrder(directions) : ctx.plan;
  return { plan, reach: deriveReach(plan, sessions), directional: { directions, sessions } };
}

export interface PlannedPart extends EntryPart {
  // NEW parts only: the gap check's outcome
  situation: RecitationSituation | null;
  requiresReason: boolean;
  classification: Classification | null;
}

export interface CombinedEntry {
  parts: PlannedPart[];
  // the juz direction the first new part decides, if any
  adopt: JuzAdoption | null;
  requiresReason: boolean;
  // what the form shows: the first new part's badge and warning (null in a «حر» track)
  classification: Classification | null;
  // the context after every part is saved
  after: EntryContext;
}

/**
 * A «حفظ جديد» entry that mixes memorized and new ayat, as it will be saved:
 * each new part judged from its own first ayah, in reading order, each
 * seeing the ones before it (so a gap needs a reason only where the new
 * memorization itself jumps). null when nothing is to split — no memorized
 * ayat (an ordinary entry), or every ayah memorized (a re-recording, as
 * before).
 */
export function planCombinedEntry(
  ctx: EntryContext,
  surahNumber: number,
  fromAyah: number,
  toAyah: number,
  subject: RecitationSubject,
  reason = "…",
  // a «حر» second track: split, but nothing judged (no order, no gap check)
  { free = false }: { free?: boolean } = {},
): CombinedEntry | null {
  const runs = memorizedRuns(ctx.reach.covered[surahNumber], fromAyah, toAyah);
  if (!runs.some((r) => r.type === "NEW") || !runs.some((r) => r.type === "LINK")) return null;

  let current = ctx;
  let adopt: JuzAdoption | null = null;
  let shown: Classification | null = null;
  const parts: PlannedPart[] = runs.map((run) => {
    if (run.type === "LINK") return { ...run, situation: null, requiresReason: false, classification: null };
    if (free) return { ...run, situation: null, requiresReason: false, classification: null };
    const judged = judgeEntry(current, surahNumber, run.fromAyah, subject);
    const c = judged.classification;
    adopt ??= judged.adopt;
    shown ??= c;
    current = withSaved(
      current,
      { type: "NEW", surahNumber, fromAyah: run.fromAyah, toAyah: run.toAyah, situation: c.situation, reason: c.requiresReason ? reason : null },
      judged.adopt,
    );
    return { ...run, situation: c.situation, requiresReason: c.requiresReason, classification: c };
  });
  return { parts, adopt, requiresReason: parts.some((p) => p.requiresReason), classification: shown, after: current };
}

/** Whether every ayah of the range is already memorized (a whole re-recording). */
export function rangeAllMemorized(ctx: EntryContext, surahNumber: number, fromAyah: number, toAyah: number): boolean {
  return memorizedRuns(ctx.reach.covered[surahNumber], fromAyah, toAyah).every((r) => r.type === "LINK");
}

const PART_LABEL: Record<PartType, string> = { NEW: "حفظ جديد", LINK: "ربط" };
// a range inside Arabic text: isolated left-to-right, or «1–10» shows as «10–1»
const rangeText = (p: { fromAyah: number; toAyah: number }) =>
  p.fromAyah === p.toAyah ? `${p.fromAyah}` : `⁦${p.fromAyah}–${p.toAyah}⁩`;

/** «حفظ جديد 11–20 + ربط 1–10» (several runs: «ربط 1–10، 16–20»). */
export function partsLabel(parts: { type: string; fromAyah: number; toAyah: number }[]): string {
  return (["NEW", "LINK"] as const)
    .map((t) => {
      const runs = parts.filter((p) => p.type === t).sort((a, b) => a.fromAyah - b.fromAyah);
      return runs.length ? `${PART_LABEL[t]} ${runs.map(rangeText).join("، ")}` : null;
    })
    .filter(Boolean)
    .join(" + ");
}

/**
 * Sessions as one entry per combo, in the given order (the combo where its
 * first row appears). A combo's entry is its first row with `parts` (every
 * row of the combo, in reading order) and its range spanning them all;
 * every other session is returned as it is, without `parts`.
 */
export function groupCombos<T extends { comboId: string | null; type: string; fromAyah: number; toAyah: number }>(
  rows: T[],
): (T & { parts?: T[] })[] {
  const byCombo = new Map<string, T[]>();
  for (const r of rows) if (r.comboId) byCombo.set(r.comboId, [...(byCombo.get(r.comboId) ?? []), r]);
  const seen = new Set<string>();
  const out: (T & { parts?: T[] })[] = [];
  for (const r of rows) {
    if (!r.comboId) {
      out.push(r);
      continue;
    }
    if (seen.has(r.comboId)) continue;
    seen.add(r.comboId);
    const parts = [...byCombo.get(r.comboId)!].sort((a, b) => a.fromAyah - b.fromAyah);
    out.push({
      ...r,
      fromAyah: Math.min(...parts.map((p) => p.fromAyah)),
      toAyah: Math.max(...parts.map((p) => p.toAyah)),
      parts,
    });
  }
  return out;
}

/** How many entries these sessions are (a combo counts once). */
export function entryCount(rows: { comboId: string | null }[]): number {
  return new Set(rows.map((r, i) => r.comboId ?? `#${i}`)).size;
}
