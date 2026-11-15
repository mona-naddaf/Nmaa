import { isQadaKind, type QadaKind } from "./kinds";
import type { QadaAccess } from "./visibility";

// «القضاء» Phase 2: «يُحسب قضاءً» — a tracker item linked to one kind of
// qada. Pure; the server applies these on every save and tick.
//
// A tick on a day adds exactly one made-up entry of that kind (source
// TRACKER, sourceRef «item:day»: the database refuses a second); unticking
// removes it. Who ticks doesn't matter (the child on an adult's 🔒 item
// too). While «القضاء» is off nothing is added, and nothing is filled in
// later. For a girl, an adult outside her «من يرى…» list never learns of a
// link to fasting: not in the form, not in the list, not in the page data.

/** The entry of one item's tick on one day. */
export const trackerRef = (itemId: string, day: string) => `${itemId}:${day}`;
/** The item of a tracker entry (for «من بند «…» في الجدول»). */
export const itemOfRef = (ref: string | null) => (ref ? ref.slice(0, ref.lastIndexOf(":")) || null : null);

/** The kinds this viewer may link an item to (empty: no field at all). */
export const linkableKinds = (a: QadaAccess | null): QadaKind[] =>
  !a || !a.edit ? [] : a.fasting ? ["FAJR", "DHUHR", "ASR", "MAGHRIB", "ISHA", "FAST"] : ["FAJR", "DHUHR", "ASR", "MAGHRIB", "ISHA"];

/** Whether this viewer sees an item's link (and so its label and form value). */
export const linkShown = (kind: QadaKind | null, a: QadaAccess | null): boolean => !!kind && !!a && (kind !== "FAST" || a.fasting);

/**
 * The link to save: what was sent when this viewer may set it, else what
 * the item had. A link this viewer can't see is kept as it is, whatever the
 * form sent (it never showed the field), and nobody sets one they can't see.
 * submitted: undefined = the form had no field; null = «لا».
 */
export function linkToSave(current: QadaKind | null, submitted: unknown, a: QadaAccess | null): QadaKind | null {
  const kinds = linkableKinds(a);
  if (kinds.length === 0 || submitted === undefined) return current;
  if (current && !linkShown(current, a)) return current;
  if (submitted === null || submitted === "") return null;
  return isQadaKind(submitted) && kinds.includes(submitted) ? submitted : current;
}

/** What a tick does to qada: add or remove its entry, or nothing (no link, or «القضاء» off). */
export const tickEffect = (on: boolean, kind: QadaKind | null, qadaOn: boolean): "add" | "remove" | "none" =>
  !qadaOn || !kind ? (on ? "none" : kind ? "remove" : "none") : on ? "add" : "remove";
