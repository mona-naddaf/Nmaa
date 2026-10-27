import { effectiveEnd, excuseDays, itemStateOn, type Excuse, type ExcuseMode, type ItemState, type Moment } from "./rules";

// «أيام العذر» as a viewer who may see it sees the tracker: which items are
// as usual, «لا يُحسب» or shown by their alternative on a day, and which
// days were excuse days. Built in the browser from what the server sent
// (only ever sent to such a viewer). Pure.

export interface ExcuseLens {
  /** What the item is on that day (and, ALT, the alternative's title). */
  view: (itemId: string, day: string) => { state: ItemState; alt: string | null };
  /** For the scores: not due that day («لا يُحسب» while excused). */
  skipped: (itemId: string, day: string) => boolean;
  /** An excuse touched that day («يوم عذر» on the day tiles). */
  isExcuseDay: (day: string) => boolean;
}

export type ExcuseItem = { id: string; excuseMode?: ExcuseMode; excuseAltTitle?: string | null };

/**
 * now: her moment (day + minute). An open excuse past its 15 days is read as
 * ended at its cap, until the server closes it (keeping nothing of the end
 * day, which the server then works out).
 */
export function excuseLens(items: ExcuseItem[], excuses: Excuse[], now: Moment): ExcuseLens {
  const settled = excuses.map((e) => {
    const eff = effectiveEnd(e, now);
    return eff?.auto ? { ...e, end: eff.end } : e;
  });
  const byId = new Map(items.map((i) => [i.id, i]));
  const days = excuseDays(settled, now.day);
  const view = (itemId: string, day: string) => {
    const item = byId.get(itemId);
    if (!item?.excuseMode || item.excuseMode === "NONE") return { state: "ORIGINAL" as const, alt: null };
    const state = itemStateOn({ id: itemId, excuseMode: item.excuseMode }, day, settled);
    return { state, alt: state === "ALT" ? (item.excuseAltTitle ?? null) : null };
  };
  return {
    view,
    skipped: (itemId, day) => view(itemId, day).state === "SKIP",
    isExcuseDay: (day) => days.has(day),
  };
}
