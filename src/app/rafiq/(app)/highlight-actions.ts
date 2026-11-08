"use server";

import {
  addColor,
  createHighlight,
  highlightGate,
  highlightsIn,
  paletteFor,
  recolorHighlight,
  removeColor,
  removeHighlight,
  renameColor,
  restoreColor,
  restoreHighlight,
} from "@/lib/highlight/server";
import type { HighlightRow, HighlightViewer, PaletteEntry } from "@/lib/highlight/rules";

// «التظليل»: the actions of every page that shows verses in «رفيق الحفظ»
// and «العائلة». An action is posted to the page it's used on, so it carries
// that area's cookie (/rafiq: the adult; /family: the child); highlightGate
// decides from the database each time. subjectId: a child's id when an adult
// is on the child's page.

/** The owner's highlights in one surah and her colours, with what the viewer may do. */
export async function loadHighlightsAction(
  surahNumber: number,
  subjectId?: string,
): Promise<{ ok: true; viewer: HighlightViewer; highlights: HighlightRow[]; palette: PaletteEntry[] } | { ok: false }> {
  const g = await highlightGate(subjectId, "view");
  if ("error" in g || !Number.isInteger(surahNumber) || surahNumber < 1 || surahNumber > 114) return { ok: false };
  const [highlights, palette] = await Promise.all([highlightsIn(g.subject.id, surahNumber), paletteFor(g.subject.id)]);
  return { ok: true, viewer: g.viewer, highlights, palette };
}

export async function createHighlightAction(input: { range: unknown; color: unknown; subjectId?: string }) {
  const g = await highlightGate(input?.subjectId, "record");
  return "error" in g ? { error: g.error } : createHighlight(g, input.range, input.color);
}

export async function removeHighlightAction(id: string, subjectId?: string) {
  const g = await highlightGate(subjectId, "record");
  return "error" in g ? { error: g.error } : removeHighlight(g, id);
}

export async function restoreHighlightAction(id: string, subjectId?: string) {
  const g = await highlightGate(subjectId, "record");
  return "error" in g ? { error: g.error } : restoreHighlight(g, id);
}

export async function recolorHighlightAction(id: string, color: string, subjectId?: string) {
  const g = await highlightGate(subjectId, "record");
  return "error" in g ? { error: g.error } : recolorHighlight(g, id, color);
}

export async function addHighlightColorAction(color: string, subjectId?: string) {
  const g = await highlightGate(subjectId, "record");
  return "error" in g ? { error: g.error } : addColor(g, color);
}

export async function renameHighlightColorAction(color: string, name: string, subjectId?: string) {
  const g = await highlightGate(subjectId, "record");
  return "error" in g ? { error: g.error } : renameColor(g, color, name);
}

export async function removeHighlightColorAction(color: string, subjectId?: string) {
  const g = await highlightGate(subjectId, "record");
  return "error" in g ? { error: g.error } : removeColor(g, color);
}

export async function restoreHighlightColorAction(undo: unknown, subjectId?: string) {
  const g = await highlightGate(subjectId, "record");
  return "error" in g ? { error: g.error } : restoreColor(g, undo);
}
