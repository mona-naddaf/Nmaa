import "server-only";
import { prisma } from "@/lib/db";
import { getRafiqUser } from "@/lib/rafiq/session";
import { resolveSubject, type Subject } from "@/lib/rafiq/subject";
import { surahText } from "@/lib/quran-data/quran-text";
import { splitAyah } from "@/lib/quran-data/words";
import { getAyahPageEntries } from "@/lib/quran-data";
import { highlightAllowed } from "./enabled";
import { DEFAULT_HIGHLIGHT_COLOR, isHighlightColor, type HighlightColor } from "./colors";
import {
  canChange,
  cleanColorName,
  MAX_HIGHLIGHT_COLORS,
  paletteOf,
  rangeProblem,
  snapToGlyphs,
  type HighlightRange,
  type HighlightRow,
  type HighlightViewer,
  type PaletteEntry,
  type QuranFacts,
  type RangeProblem,
} from "./rules";

// «التظليل» on the server: who may see and change whose highlights, and the
// writes. Every action starts with highlightGate, which decides from the
// database (the session, the family, the child's switch, HIGHLIGHT_EMAILS);
// the page only ever gets the highlights of the page's owner.

export const QURAN_FACTS: QuranFacts = {
  wordCount: (s, a) => {
    const text = surahText(s)?.[a - 1];
    return text ? splitAyah(s, a, text).words.length : 0;
  },
  pageOf: (s, a) => getAyahPageEntries(s)?.[a - 1]?.[1] ?? null,
};


export type HighlightGate = { subject: Subject; viewer: HighlightViewer };

const NOT_AVAILABLE = { error: "التظليل غير متاح هنا." };

/** May the signed-in person see (need "view") or make (need "record") highlights on this subject's pages? */
export async function highlightGate(subjectId: unknown, need: "view" | "record"): Promise<HighlightGate | { error: string }> {
  const s = await resolveSubject(subjectId, need);
  if ("error" in s) return s;
  if (s.kind === "ADULT") {
    const me = await getRafiqUser();
    if (!me || me.id !== s.id || !highlightAllowed(me.email)) return NOT_AVAILABLE;
    return { subject: s, viewer: "self" };
  }
  // a child's pages: the founder's email, her switch, and the adult's rights
  const child = await prisma.rafiqUser.findUnique({
    where: { id: s.id },
    select: { highlightEnabled: true, family: { select: { founderId: true, founder: { select: { email: true } }, members: { where: { userId: s.actorId }, select: { canEditChildren: true } } } } },
  });
  if (!child?.highlightEnabled || !highlightAllowed(child.family?.founder.email)) return NOT_AVAILABLE;
  if (s.actorKind === "CHILD") return { subject: s, viewer: "child" };
  const canEdit = child.family?.founderId === s.actorId || child.family?.members[0]?.canEditChildren === true;
  return { subject: s, viewer: canEdit ? "adult-edit" : "adult-view" };
}

/** Whether a page shows «التظليل» at all (no DB beyond what the gate needs). */
export async function highlightOn(subjectId?: string): Promise<boolean> {
  return !("error" in (await highlightGate(subjectId, "view")));
}

export async function paletteFor(ownerId: string): Promise<PaletteEntry[]> {
  return paletteOf(await prisma.rafiqHighlightColor.findMany({ where: { userId: ownerId }, select: { color: true, name: true, sortOrder: true } }));
}

/** The owner's highlights in one surah, with who made each (an adult's name on a child's page). */
export async function highlightsIn(ownerId: string, surahNumber: number): Promise<HighlightRow[]> {
  const rows = await prisma.rafiqHighlight.findMany({
    where: { userId: ownerId, surahNumber, removedAt: null },
    orderBy: [{ fromAyah: "asc" }, { fromWord: "asc" }],
    select: { id: true, surahNumber: true, fromAyah: true, fromWord: true, toAyah: true, toWord: true, color: true, byAdult: true, by: { select: { name: true } } },
  });
  return rows.map(({ by, color, ...r }) => ({ ...r, color: isHighlightColor(color) ? color : DEFAULT_HIGHLIGHT_COLOR, byName: r.byAdult ? (by?.name ?? null) : null }));
}

type Result<T = object> = (T & { ok: true }) | { error: string; problem?: RangeProblem };

const asRange = (r: unknown): HighlightRange | null => {
  if (!r || typeof r !== "object") return null;
  const o = r as Record<string, unknown>;
  const keys = ["surahNumber", "fromAyah", "fromWord", "toAyah", "toWord"] as const;
  if (!keys.every((k) => Number.isInteger(o[k]))) return null;
  return Object.fromEntries(keys.map((k) => [k, o[k]])) as HighlightRange;
};

/** A new highlight on the gate's subject; the range is snapped and checked again here. */
export async function createHighlight(g: HighlightGate, rawRange: unknown, rawColor: unknown): Promise<Result<{ highlight: HighlightRow }>> {
  const parsed = asRange(rawRange);
  if (!parsed) return { error: "invalid", problem: "invalid" };
  const range = snapToGlyphs(parsed);
  const palette = await paletteFor(g.subject.id);
  const color: HighlightColor = isHighlightColor(rawColor) && palette.some((p) => p.color === rawColor) ? rawColor : DEFAULT_HIGHLIGHT_COLOR;
  const [existing, total] = await Promise.all([
    liveIn(g.subject.id, range.surahNumber),
    prisma.rafiqHighlight.count({ where: { userId: g.subject.id, removedAt: null } }),
  ]);
  const problem = rangeProblem(range, QURAN_FACTS, existing, total);
  if (problem) return { error: problem, problem };
  const byAdult = !g.subject.self && g.subject.actorKind === "ADULT";
  const row = await prisma.rafiqHighlight.create({
    data: { userId: g.subject.id, ...range, color, byAdult, byId: byAdult ? g.subject.actorId : null },
    select: { id: true, by: { select: { name: true } } },
  });
  return { ok: true, highlight: { id: row.id, ...range, color, byAdult, byName: byAdult ? (row.by?.name ?? null) : null } };
}

const RANGE_SELECT = { surahNumber: true, fromAyah: true, fromWord: true, toAyah: true, toWord: true } as const;

/** The owner's shown highlights in a surah (not removed), as ranges. */
const liveIn = (ownerId: string, surahNumber: number, except?: string) =>
  prisma.rafiqHighlight.findMany({ where: { userId: ownerId, surahNumber, removedAt: null, ...(except ? { id: { not: except } } : {}) }, select: RANGE_SELECT });

async function ownHighlight(g: HighlightGate, id: unknown, removed = false) {
  if (typeof id !== "string") return null;
  const h = await prisma.rafiqHighlight.findFirst({
    where: { id, userId: g.subject.id, removedAt: removed ? { not: null } : null },
    select: { id: true, byAdult: true, ...RANGE_SELECT },
  });
  return h && canChange(g.viewer, h) ? h : null;
}

/** «إزالة التظليل»: hidden at once, kept a while for «تراجع»; older removals of hers are deleted for good. */
export async function removeHighlight(g: HighlightGate, id: unknown): Promise<Result> {
  const h = await ownHighlight(g, id);
  if (!h) return { error: "not-found" };
  const now = new Date();
  await prisma.$transaction([
    prisma.rafiqHighlight.update({ where: { id: h.id }, data: { removedAt: now } }),
    prisma.rafiqHighlight.deleteMany({ where: { userId: g.subject.id, removedAt: { lt: new Date(now.getTime() - UNDO_KEEP_MS) } } }),
  ]);
  return { ok: true };
}

/** «تراجع» after a removal: back as it was, unless a new highlight took its place meanwhile. */
export async function restoreHighlight(g: HighlightGate, id: unknown): Promise<Result> {
  const h = await ownHighlight(g, id, true);
  if (!h) return { error: "not-found" };
  const [existing, total] = await Promise.all([liveIn(g.subject.id, h.surahNumber), prisma.rafiqHighlight.count({ where: { userId: g.subject.id, removedAt: null } })]);
  const problem = rangeProblem(h, QURAN_FACTS, existing, total);
  if (problem) return { error: problem, problem };
  await prisma.rafiqHighlight.update({ where: { id: h.id }, data: { removedAt: null } });
  return { ok: true };
}

// a removal stays undoable this long (the toast shows 10 s); after that it's purged on her next removal
const UNDO_KEEP_MS = 60 * 60 * 1000;

export async function recolorHighlight(g: HighlightGate, id: unknown, rawColor: unknown): Promise<Result> {
  const h = await ownHighlight(g, id);
  if (!h || !isHighlightColor(rawColor)) return { error: "not-found" };
  if (!(await paletteFor(g.subject.id)).some((p) => p.color === rawColor)) return { error: "not-found" };
  await prisma.rafiqHighlight.update({ where: { id: h.id }, data: { color: rawColor } });
  return { ok: true };
}

// ---- colours (the subject's palette; on a child's page, the child's) ----

const mayManageColors = (g: HighlightGate) => g.viewer !== "adult-view";

export async function addColor(g: HighlightGate, rawColor: unknown): Promise<Result> {
  if (!mayManageColors(g) || !isHighlightColor(rawColor) || rawColor === DEFAULT_HIGHLIGHT_COLOR) return { error: "invalid" };
  const palette = await paletteFor(g.subject.id);
  if (palette.some((p) => p.color === rawColor)) return { ok: true };
  if (palette.length >= MAX_HIGHLIGHT_COLORS) return { error: "max-colors" };
  const last = await prisma.rafiqHighlightColor.aggregate({ where: { userId: g.subject.id }, _max: { sortOrder: true } });
  await prisma.rafiqHighlightColor.create({ data: { userId: g.subject.id, color: rawColor, sortOrder: (last._max.sortOrder ?? 0) + 1 } });
  return { ok: true };
}

export async function renameColor(g: HighlightGate, rawColor: unknown, rawName: unknown): Promise<Result> {
  const clean = cleanColorName(rawName);
  if (!mayManageColors(g) || !isHighlightColor(rawColor) || !clean) return { error: "invalid" };
  if (!(await paletteFor(g.subject.id)).some((p) => p.color === rawColor)) return { error: "invalid" };
  // the default colour has no row until it's named
  await prisma.rafiqHighlightColor.upsert({
    where: { userId_color: { userId: g.subject.id, color: rawColor } },
    create: { userId: g.subject.id, color: rawColor, name: clean.name, sortOrder: 0 },
    update: { name: clean.name },
  });
  return { ok: true };
}

/** Removes a colour (never the default): its highlights move to the default. Returns what undo needs. */
export async function removeColor(g: HighlightGate, rawColor: unknown): Promise<Result<{ undo: { color: HighlightColor; name: string | null; sortOrder: number; ids: string[] } }>> {
  if (!mayManageColors(g) || !isHighlightColor(rawColor) || rawColor === DEFAULT_HIGHLIGHT_COLOR) return { error: "invalid" };
  const row = await prisma.rafiqHighlightColor.findUnique({ where: { userId_color: { userId: g.subject.id, color: rawColor } } });
  if (!row) return { error: "invalid" };
  const moved = await prisma.rafiqHighlight.findMany({ where: { userId: g.subject.id, color: rawColor }, select: { id: true } });
  await prisma.$transaction([
    prisma.rafiqHighlight.updateMany({ where: { userId: g.subject.id, color: rawColor }, data: { color: DEFAULT_HIGHLIGHT_COLOR } }),
    prisma.rafiqHighlightColor.delete({ where: { id: row.id } }),
  ]);
  return { ok: true, undo: { color: rawColor, name: row.name, sortOrder: row.sortOrder, ids: moved.map((m) => m.id) } };
}

/** Undo of removeColor: the colour back (if there's room) and those highlights back on it. */
export async function restoreColor(g: HighlightGate, raw: unknown): Promise<Result> {
  if (!mayManageColors(g) || !raw || typeof raw !== "object") return { error: "invalid" };
  const u = raw as { color?: unknown; name?: unknown; sortOrder?: unknown; ids?: unknown };
  const clean = cleanColorName(u.name);
  if (!isHighlightColor(u.color) || u.color === DEFAULT_HIGHLIGHT_COLOR || !clean || !Number.isInteger(u.sortOrder) || !Array.isArray(u.ids)) return { error: "invalid" };
  const color = u.color;
  const palette = await paletteFor(g.subject.id);
  if (!palette.some((p) => p.color === color)) {
    if (palette.length >= MAX_HIGHLIGHT_COLORS) return { error: "max-colors" };
    await prisma.rafiqHighlightColor.create({ data: { userId: g.subject.id, color, name: clean.name, sortOrder: u.sortOrder as number } });
  }
  const ids = u.ids.filter((i): i is string => typeof i === "string").slice(0, 1000);
  await prisma.rafiqHighlight.updateMany({ where: { userId: g.subject.id, id: { in: ids }, color: DEFAULT_HIGHLIGHT_COLOR }, data: { color } });
  return { ok: true };
}

/** HIGHLIGHT_EMAILS reaches this family (its founder's email): the child's «التظليل» switch is offered. */
export async function familyHighlightAllowed(familyId: string): Promise<boolean> {
  if (!process.env.HIGHLIGHT_EMAILS?.trim()) return false;
  const f = await prisma.family.findUnique({ where: { id: familyId }, select: { founder: { select: { email: true } } } });
  return !!f && highlightAllowed(f.founder.email);
}
