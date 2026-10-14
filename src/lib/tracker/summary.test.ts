import { test } from "node:test";
import assert from "node:assert/strict";
import { comparisonLabel, computeSummary, percentLabel, periodLabel, periodRange, type SummaryItem } from "./summary";
import { zoneToday } from "@/lib/time/zone";

const EVERY_DAY = 127;
// bit 0 = Sunday … bit 6 = Saturday
const SUN_TUE = (1 << 0) | (1 << 2);
const item = (id: string, value: number, fromDay: string, opts: Partial<SummaryItem> = {}): SummaryItem => ({
  id,
  title: id,
  value,
  days: EVERY_DAY,
  fromDay,
  untilDay: null,
  ...opts,
});

test("period boundaries: week (Sunday–Saturday), month, quarter, half, year, and moving back", () => {
  // 2026-10-14 is a Wednesday
  assert.deepEqual(periodRange("week", "2026-10-14"), { from: "2026-10-11", to: "2026-10-17" });
  assert.deepEqual(periodRange("week", "2026-10-14", -1), { from: "2026-10-04", to: "2026-10-10" });
  assert.deepEqual(periodRange("month", "2026-10-14"), { from: "2026-10-01", to: "2026-10-31" });
  assert.deepEqual(periodRange("month", "2026-03-31", -1), { from: "2026-02-01", to: "2026-02-28" });
  assert.deepEqual(periodRange("month", "2026-01-05", -1), { from: "2025-12-01", to: "2025-12-31" });
  assert.deepEqual(periodRange("quarter", "2026-10-14"), { from: "2026-10-01", to: "2026-12-31" });
  assert.deepEqual(periodRange("quarter", "2026-10-14", -1), { from: "2026-07-01", to: "2026-09-30" });
  assert.deepEqual(periodRange("half", "2026-10-14"), { from: "2026-07-01", to: "2026-12-31" });
  assert.deepEqual(periodRange("half", "2026-03-01", -1), { from: "2025-07-01", to: "2025-12-31" });
  assert.deepEqual(periodRange("year", "2026-10-14"), { from: "2026-01-01", to: "2026-12-31" });
  assert.deepEqual(periodRange("year", "2026-10-14", -2), { from: "2024-01-01", to: "2024-12-31" });
  assert.equal(periodLabel("week", "2026-10-11", "2026-10-17"), "11 – 17 أكتوبر 2026");
  assert.equal(periodLabel("week", "2026-09-27", "2026-10-03"), "27 سبتمبر – 3 أكتوبر 2026");
  assert.equal(periodLabel("month", "2026-10-01", "2026-10-31"), "أكتوبر 2026");
  assert.equal(periodLabel("quarter", "2026-10-01", "2026-12-31"), "الربع الرابع 2026");
  assert.equal(periodLabel("half", "2026-01-01", "2026-06-30"), "النصف الأول 2026");
  assert.equal(periodLabel("year", "2026-01-01", "2026-12-31"), "2026");
});

test("period boundaries follow the course's day around midnight (and Rafiq's own day)", () => {
  // Saturday 2026-10-31 21:30 UTC = Sunday 1 November 00:30 in Riyadh, Saturday 22:30 in Rabat
  const now = new Date("2026-10-31T21:30:00Z");
  const riyadh = zoneToday("Asia/Riyadh", now);
  const rabat = zoneToday("Africa/Casablanca", now);
  assert.deepEqual(periodRange("week", riyadh), { from: "2026-11-01", to: "2026-11-07" });
  assert.deepEqual(periodRange("week", rabat), { from: "2026-10-25", to: "2026-10-31" });
  assert.deepEqual(periodRange("month", riyadh), { from: "2026-11-01", to: "2026-11-30" });
  assert.deepEqual(periodRange("month", rabat), { from: "2026-10-01", to: "2026-10-31" });
  // Rafiq: her browser's day is passed in as is
  assert.deepEqual(periodRange("month", "2026-11-01"), { from: "2026-11-01", to: "2026-11-30" });
});

test("commitment: due days, today only once ticked, future days, weighting by value", () => {
  // today Wednesday 2026-10-14; the week 11–17
  const items = [item("a", 1, "2026-01-01"), item("b", 3, "2026-01-01")];
  const s = computeSummary({
    items,
    checks: {
      "2026-10-11": ["a", "b"], // complete
      "2026-10-12": ["a"], // a only
      "2026-10-13": [], // nothing
      "2026-10-14": ["b"], // today: b ticked, a not yet
    },
    from: "2026-10-11",
    to: "2026-10-17",
    today: "2026-10-14",
  });
  const a = s.items.find((i) => i.id === "a")!;
  const b = s.items.find((i) => i.id === "b")!;
  // a: due Sun, Mon, Tue (today unticked: not due) → 2/3
  assert.deepEqual([a.due, a.done], [3, 2]);
  // b: due Sun, Mon, Tue and today (ticked) → 2/4
  assert.deepEqual([b.due, b.done], [4, 2]);
  // weighted: (1×2 + 3×2) / (1×3 + 3×4) = 8/15
  assert.ok(Math.abs(s.overall! - (8 / 15) * 100) < 1e-9);
  assert.deepEqual(
    s.days.map((d) => [d.day.slice(8), d.state, d.earned, d.possible, d.today]),
    [
      ["11", "scored", 4, 4, false],
      ["12", "scored", 1, 4, false],
      ["13", "scored", 0, 4, false],
      ["14", "scored", 3, 4, true],
      ["15", "future", 0, 0, false],
      ["16", "future", 0, 0, false],
      ["17", "future", 0, 0, false],
    ],
  );
  assert.deepEqual([s.scoredDays, s.completeDays, s.bestRun], [4, 1, 1]);
});

test("commitment: approval date, archived items, weekday masks and neutral days", () => {
  const items = [
    // a student's own item approved on Tuesday the 13th: not due before
    item("own", 2, "2026-10-13"),
    // archived on Tuesday: due until Monday only
    item("old", 1, "2026-01-01", { untilDay: "2026-10-13" }),
    // Sundays and Tuesdays only
    item("halaqa", 4, "2026-01-01", { days: SUN_TUE }),
  ];
  const s = computeSummary({
    items,
    checks: { "2026-10-11": ["halaqa"], "2026-10-12": ["old"], "2026-10-13": ["own", "halaqa"] },
    from: "2026-10-11",
    to: "2026-10-14",
    today: "2026-10-15",
  });
  const get = (id: string) => s.items.find((i) => i.id === id)!;
  assert.deepEqual([get("own").due, get("own").done], [2, 1]); // 13th ✓, 14th ✗
  assert.deepEqual([get("old").due, get("old").done], [2, 1]); // 11th ✗, 12th ✓
  assert.deepEqual([get("halaqa").due, get("halaqa").done], [2, 2]); // Sunday ✓, Tuesday ✓
  assert.deepEqual(
    s.days.map((d) => [d.day.slice(8), d.earned, d.possible]),
    [
      ["11", 4, 5], // halaqa + old
      ["12", 1, 1], // old only (Monday)
      ["13", 6, 6], // own + halaqa (old archived)
      ["14", 0, 2], // own only (Wednesday)
    ],
  );
  // a day with nothing scheduled is neutral, not 0%
  const n = computeSummary({ items: [item("x", 1, "2026-01-01", { days: 1 << 0 })], checks: {}, from: "2026-10-12", to: "2026-10-13", today: "2026-10-20" });
  assert.deepEqual(n.days.map((d) => d.state), ["neutral", "neutral"]);
  assert.equal(n.overall, null);
  assert.deepEqual(n.items, []); // never scheduled in the period: not listed
  assert.equal(percentLabel(n.overall), "—");
});

test("best run: neutral days don't break it, a missed day does, an unfinished today doesn't", () => {
  const items = [item("a", 1, "2026-01-01", { days: 0b0111111 })]; // no Saturdays
  const checks: Record<string, string[]> = {};
  for (const d of ["2026-10-01", "2026-10-02", "2026-10-04", "2026-10-05", "2026-10-07", "2026-10-08", "2026-10-09"]) checks[d] = ["a"];
  // 1 Thu ✓, 2 Fri ✓, 3 Sat neutral, 4 Sun ✓, 5 Mon ✓, 6 Tue ✗, 7 Wed ✓, 8 Thu ✓, 9 Fri ✓, 10 Sat neutral, 11 Sun = today, unticked
  const s = computeSummary({ items, checks, from: "2026-10-01", to: "2026-10-31", today: "2026-10-11" });
  assert.equal(s.bestRun, 4); // 1, 2, (3), 4, 5
  assert.equal(s.days.find((d) => d.day === "2026-10-03")!.state, "neutral");
  // today unticked is not due: 1–10 Oct has 8 due days (excluding Saturdays) of which 7 ticked
  assert.deepEqual([s.items[0].due, s.items[0].done], [8, 7]);
});

test("comparison with the previous period", () => {
  assert.equal(comparisonLabel("month", 82.4, 70.2), "+12٪ عن الشهر السابق");
  assert.equal(comparisonLabel("week", 60, 65), "−5٪ عن الأسبوع السابق");
  assert.equal(comparisonLabel("year", 50.2, 49.9), "مثل السنة السابقة");
  assert.equal(comparisonLabel("quarter", 50, null), null);
  assert.equal(percentLabel(86.6), "87٪");
});
