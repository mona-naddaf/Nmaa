// «العائلة»: one tracker item added to several children at once, and a whole
// tracker copied to other children — what each child gets, pure (no DB), so
// it's unit-tested (tracker-copy.test.ts). The actions
// (src/app/rafiq/(app)/tracker/family-actions.ts) check who may, lock each
// child and create what this plans.
//
// For each child, in the source's order:
// - an item whose title she already has (active, same title once spaces are
//   tidied) is skipped — so is a second item of the same title in the source;
// - once her tracker holds the maximum, the rest is skipped;
// - an item keeps its time only while her «الجدول اليومي» is on, and a time
//   relative to a prayer only when there's a city for prayer times —
//   otherwise it's added without a time, and said so.
// Copies are independent items: nothing links them afterwards.

import type { SlotRow } from "@/lib/tracker/schedule";

export type CopySource = { title: string; value: number; days: number; slots: SlotRow[] };

export type CopyTarget = {
  id: string;
  name: string;
  gender: "MALE" | "FEMALE";
  // her active items' titles, and how many she has
  titles: string[];
  count: number;
  agenda: boolean;
  // a city for prayer times (a child's is her family's)
  hasPlace: boolean;
};

export type TargetPlan = {
  id: string;
  name: string;
  gender: "MALE" | "FEMALE";
  create: { item: CopySource; withTime: boolean }[];
  duplicates: number;
  full: number;
  // added, but without the time it had (a prayer-relative time and no city)
  untimed: number;
};

export const normalizeTitle = (t: string) => t.replace(/\s+/g, " ").trim();

export function planCopy(source: CopySource[], targets: CopyTarget[], max: number): TargetPlan[] {
  return targets.map((t) => {
    const titles = new Set(t.titles.map(normalizeTitle));
    const plan: TargetPlan = { id: t.id, name: t.name, gender: t.gender, create: [], duplicates: 0, full: 0, untimed: 0 };
    let count = t.count;
    for (const item of source) {
      const title = normalizeTitle(item.title);
      if (titles.has(title)) {
        plan.duplicates++;
        continue;
      }
      if (count >= max) {
        plan.full++;
        continue;
      }
      const timed = t.agenda && item.slots.length > 0;
      const withTime = timed && (t.hasPlace || item.slots.every((s) => s.anchor === null));
      if (timed && !withTime) plan.untimed++;
      plan.create.push({ item: { ...item, title }, withTime });
      titles.add(title);
      count++;
    }
    return plan;
  });
}

// ---------- the report (wording) ----------

/** «بند واحد» / «بندان» / «3 بنود» / «11 بندًا» / «100 بند» (digits, as elsewhere). */
export function itemsCount(n: number): string {
  if (n === 1) return "بند واحد";
  if (n === 2) return "بندان";
  const r = n % 100;
  if (n >= 100 && r <= 2) return `${n} بند`;
  if (r >= 3 && r <= 10) return `${n} بنود`;
  return `${n} بندًا`;
}

const her = (g: "MALE" | "FEMALE", m: string, f: string) => (g === "FEMALE" ? f : m);
const NO_CITY = "لم تُحدَّد مدينة العائلة لمواقيت الصلاة";

export type ReportLine = { name: string; gender: "MALE" | "FEMALE"; added: number; duplicates: number; full: number; untimed: number };

export const reportOf = (plans: TargetPlan[], added: Record<string, number>): ReportLine[] =>
  plans.map((p) => ({ name: p.name, gender: p.gender, added: added[p.id] ?? 0, duplicates: p.duplicates, full: p.full, untimed: p.untimed }));

/** One new item for several children: who got it, and why not the others. */
export function addReport(lines: ReportLine[], max: number): string[] {
  const out: string[] = [];
  const got = lines.filter((l) => l.added > 0);
  if (got.length > 0) out.push(`أُضيف البند إلى: ${got.map((l) => l.name).join("، ")} ✓`);
  for (const l of lines) {
    if (l.duplicates > 0) out.push(`لم يُضَف إلى ${l.name}: موجود في ${her(l.gender, "جدوله", "جدولها")}`);
    else if (l.full > 0) out.push(`لم يُضَف إلى ${l.name}: بلغ ${her(l.gender, "جدوله", "جدولها")} ${max} بندًا`);
    else if (l.untimed > 0) out.push(`أُضيف إلى ${l.name} بلا وقت: ${NO_CITY}`);
  }
  return out;
}

/**
 * A copied tracker: one line per child. The counts come after a colon, so
 * nothing has to agree with them: «ليلى — نُسخ: 5 بنود · تُرك ما يوجد في
 * جدولها بالاسم نفسه: بندان».
 */
export function copyReport(lines: ReportLine[], max: number): string[] {
  return lines.map((l) => {
    const parts = [l.added > 0 ? `نُسخ: ${itemsCount(l.added)}` : "لم يُنسخ شيء"];
    if (l.duplicates > 0) parts.push(`تُرك ما يوجد في ${her(l.gender, "جدوله", "جدولها")} بالاسم نفسه: ${itemsCount(l.duplicates)}`);
    if (l.full > 0) parts.push(`تُرك ما زاد على ${max} بندًا: ${itemsCount(l.full)}`);
    if (l.untimed > 0) parts.push(`بلا وقت (${NO_CITY}): ${itemsCount(l.untimed)}`);
    return `${l.name} — ${parts.join(" · ")}`;
  });
}
