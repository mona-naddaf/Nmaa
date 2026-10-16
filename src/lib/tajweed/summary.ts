// «ملخّص أخطاء التجويد»: a student's open detailed tajweed mistakes counted
// by what they are about — a makhraj by its letter («مخرج الضاد»), a sifa
// by name («الاستطالة»), a rule by its group («القلقلة»), with the rules
// inside it. Pure and client-safe; the loader is summary-data.ts.

import { splitLetters } from "./letters";
import { LETTER_NAME, SIFAT } from "./letter-facts";
import { GENERAL, hukmByCode, type TajweedKind } from "./taxonomy";

export interface SummaryRow {
  kind: TajweedKind;
  code: string;
  /** the letter unit as flagged (letter mistakes), for a makhraj's letter */
  letterText: string | null;
}

export interface SummaryGroup {
  key: string;
  label: string;
  count: number;
  /** a rule group's rules, the most frequent first (rules only) */
  parts: { label: string; count: number }[];
}

/** The two periods the block shows. */
export interface TajweedSummary {
  recent: SummaryGroup[];
  all: SummaryGroup[];
}

/** The window of «آخر ٣٠ يومًا», in days including today. */
export const SUMMARY_RECENT_DAYS = 30;

function groupOf(r: SummaryRow): { key: string; label: string; part: string | null } {
  if (r.kind === "MAKHRAJ") {
    if (r.code === "khayshum") return { key: "M:khayshum", label: "مخرج الغنّة (الخيشوم)", part: null };
    const letter = r.letterText ? splitLetters(r.letterText)[0]?.letter : undefined;
    const name = letter ? LETTER_NAME[letter] : undefined;
    return name ? { key: `M:${letter}`, label: `مخرج ${name}`, part: null } : { key: "M:", label: "مخرج (عام)", part: null };
  }
  if (r.kind === "SIFA") {
    const s = SIFAT.find((x) => x.code === r.code);
    return s ? { key: `S:${s.code}`, label: s.label, part: null } : { key: "S:", label: "صفة (عامّة)", part: null };
  }
  const h = r.code === GENERAL ? null : hukmByCode(r.code);
  // the same group on a letter and on a gap (e.g. النون الساكنة والتنوين) counts as one
  return h ? { key: `H:${h.group.label}`, label: h.group.label, part: h.rule.label } : { key: "H:", label: "حكم تجويد (عام)", part: null };
}

/** Counted and sorted: the most frequent first, then by label. */
export function summarize(rows: SummaryRow[]): SummaryGroup[] {
  const groups = new Map<string, SummaryGroup & { partMap: Map<string, number> }>();
  for (const r of rows) {
    const g = groupOf(r);
    const entry = groups.get(g.key) ?? { key: g.key, label: g.label, count: 0, parts: [], partMap: new Map() };
    entry.count++;
    if (g.part) entry.partMap.set(g.part, (entry.partMap.get(g.part) ?? 0) + 1);
    groups.set(g.key, entry);
  }
  const byCount = <T extends { label: string; count: number }>(a: T, b: T) => b.count - a.count || a.label.localeCompare(b.label, "ar");
  return [...groups.values()]
    .map(({ partMap, ...g }) => ({ ...g, parts: [...partMap].map(([label, count]) => ({ label, count })).sort(byCount) }))
    .sort(byCount);
}
