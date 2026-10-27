import { test } from "node:test";
import assert from "node:assert/strict";
import { excuseLens } from "./lens";
import { buildDashboard, type DashFacts, type DashRows } from "@/lib/family/dashboard-build";
import { dayScore } from "@/lib/tracker/rules";
import { keyOf, type Excuse } from "./rules";

// What she sees of her excuse in her views, and what her family's dashboard
// gets instead: the same scores, with nothing of the excuse.

const items = [
  { id: "asr", excuseMode: "ALT" as const, excuseAltTitle: "100 تسبيحة" },
  { id: "quran", excuseMode: "SKIP" as const, excuseAltTitle: null },
  { id: "azkar", excuseMode: "NONE" as const, excuseAltTitle: null },
];
// started on the 20th at 13:00, the Asr item already ticked that day (kept as it was)
const open: Excuse = { start: { day: "2026-10-20", min: 780 }, end: null, keepOriginal: [keyOf("2026-10-20", "asr")], keepExcused: [] };

test("lens: each item as the excuse shows it, day by day", () => {
  const lens = excuseLens(items, [open], { day: "2026-10-22", min: 600 });
  assert.deepEqual(lens.view("asr", "2026-10-20"), { state: "ORIGINAL", alt: null });
  assert.deepEqual(lens.view("asr", "2026-10-21"), { state: "ALT", alt: "100 تسبيحة" });
  assert.equal(lens.skipped("quran", "2026-10-20"), true);
  assert.equal(lens.skipped("quran", "2026-10-19"), false);
  assert.equal(lens.skipped("azkar", "2026-10-21"), false);
  assert.equal(lens.isExcuseDay("2026-10-20"), true);
  assert.equal(lens.isExcuseDay("2026-10-19"), false);
  // items she doesn't know a setting for (no excuseMode sent): as usual
  assert.deepEqual(lens.view("other", "2026-10-21"), { state: "ORIGINAL", alt: null });
});

test("lens: an open excuse past its 15 days reads as ended at its cap", () => {
  const lens = excuseLens(items, [open], { day: "2026-11-06", min: 600 });
  assert.equal(lens.skipped("quran", "2026-11-03"), true);
  // the cap is the 4th at 13:00: its end day keeps only what the server works
  // out when it closes it (none yet), and from the 5th on all is as usual
  assert.equal(lens.skipped("quran", "2026-11-04"), false);
  assert.equal(lens.isExcuseDay("2026-11-04"), true);
  assert.equal(lens.isExcuseDay("2026-11-05"), false);
});

const facts: DashFacts = {
  familyId: "f",
  siblingsVisible: false,
  children: [],
  adults: [
    { id: "mona", name: "منى", gender: "FEMALE", createdAt: new Date("2026-09-01T00:00:00Z"), planChangedAt: null, shareProgress: false, shareTracker: true },
    { id: "ahmad", name: "أحمد", gender: "MALE", createdAt: new Date("2026-09-01T00:00:00Z"), planChangedAt: null, shareProgress: false, shareTracker: false },
  ],
};
const T = (d: string) => new Date(`${d}T00:00:00Z`);
const rows: DashRows = {
  planItems: [],
  sessions: [],
  goals: [],
  commitDays: [],
  trackerItems: [
    { id: "quran", userId: "mona", value: 5, days: 127, createdAt: new Date("2026-10-01T08:00:00Z"), archivedAt: null },
    { id: "azkar", userId: "mona", value: 3, days: 127, createdAt: new Date("2026-10-01T08:00:00Z"), archivedAt: null },
  ],
  checks: [
    { userId: "mona", itemId: "quran", day: T("2026-10-19") },
    { userId: "mona", itemId: "azkar", day: T("2026-10-19") },
    { userId: "mona", itemId: "azkar", day: T("2026-10-21") },
    { userId: "mona", itemId: "quran", day: T("2026-10-23") },
  ],
};

test("dashboard: her shared tracker is scored without the skipped items, and nothing of the excuse leaves", () => {
  const skipped = { mona: ["2026-10-20", "2026-10-21", "2026-10-22"].map((d) => keyOf(d, "quran")) };
  const plain = buildDashboard({ kind: "ADULT", id: "ahmad" }, facts, rows, new Date("2026-10-23T10:00:00Z"));
  const quiet = buildDashboard({ kind: "ADULT", id: "ahmad" }, facts, { ...rows, skipped }, new Date("2026-10-23T10:00:00Z"));
  const score = (d: typeof quiet, day: string) => {
    const t = d.adults[0].tracker!;
    return dayScore(t.items, new Set(t.checks[day] ?? []), day);
  };
  // as usual outside the excuse
  assert.deepEqual(score(quiet, "2026-10-19"), score(plain, "2026-10-19"));
  assert.deepEqual(score(quiet, "2026-10-19"), { day: "2026-10-19", possible: 8, earned: 8 });
  assert.deepEqual(score(quiet, "2026-10-23"), { day: "2026-10-23", possible: 8, earned: 5 });
  // during it: only «azkar» is due — done, so the day is complete
  assert.deepEqual(score(plain, "2026-10-21"), { day: "2026-10-21", possible: 8, earned: 3 });
  assert.deepEqual(score(quiet, "2026-10-21"), { day: "2026-10-21", possible: 3, earned: 3 });
  // anonymous rows only: no item id, no excuse word, no skipped day list
  const out = JSON.stringify(quiet);
  for (const leak of ["quran", "azkar", "excuse", "skip", "SKIP"]) assert.ok(!out.includes(leak), leak);
});
