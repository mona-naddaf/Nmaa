import { KINDS, PRAYERS, type QadaAction, type QadaKind } from "./kinds";

// «القضاء»: everything shown is worked out from the log. Pure.

export type CountRow = { kind: QadaKind; action: QadaAction; count: number };

export type KindTotal = { owed: number; done: number; remaining: number };

export type TrackTotal = KindTotal & {
  // 0–100: what's done of what's owed (more done than owed counts as all of it)
  pct: number;
};

export type Totals = Record<QadaKind, KindTotal> & { prayers: TrackTotal; fast: TrackTotal };

const kindTotal = (owed: number, done: number): KindTotal => ({ owed, done, remaining: Math.max(0, owed - done) });

export function totalsOf(rows: CountRow[]): Totals {
  const owed = Object.fromEntries(KINDS.map((k) => [k, 0])) as Record<QadaKind, number>;
  const done = { ...owed };
  for (const r of rows) (r.action === "OWED" ? owed : done)[r.kind] += r.count;
  const per = Object.fromEntries(KINDS.map((k) => [k, kindTotal(owed[k], done[k])])) as Record<QadaKind, KindTotal>;
  return { ...per, prayers: track(PRAYERS.map((k) => per[k])), fast: track([per.FAST]) };
}

function track(parts: KindTotal[]): TrackTotal {
  const owed = parts.reduce((s, p) => s + p.owed, 0);
  const done = parts.reduce((s, p) => s + p.done, 0);
  // a prayer done beyond what's owed for it doesn't make up for another
  const counted = parts.reduce((s, p) => s + Math.min(p.done, p.owed), 0);
  const remaining = parts.reduce((s, p) => s + p.remaining, 0);
  return { owed, done, remaining, pct: owed > 0 ? Math.min(100, (counted / owed) * 100) : 0 };
}

/** What's left of each prayer from a set of rows (the start of today: rows before it). */
export function remainingOf(rows: CountRow[]): Record<QadaKind, number> {
  const t = totalsOf(rows);
  return Object.fromEntries(KINDS.map((k) => [k, t[k].remaining])) as Record<QadaKind, number>;
}
