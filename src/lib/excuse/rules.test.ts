import { test } from "node:test";
import assert from "node:assert/strict";
import {
  boundaryKeys,
  checkEnd,
  checkStart,
  effectiveEnd,
  excuseDays,
  excusedOn,
  isActive,
  itemStateOn,
  keyOf,
  parseMoment,
  pausedDays,
  skippedBy,
  validateItemExcuse,
  type Excuse,
  type ExcuseMode,
} from "./rules";
import { dayScore, isComplete, type ScoredItem } from "@/lib/tracker/rules";
import { computeSummary, type SummaryItem } from "@/lib/tracker/summary";

// A day of hers: Dhuhr at 12:00, Asr at 15:30, Maghrib at 18:00; she starts at 14:00.
const D = "2026-10-20";
const items = [
  { id: "dhuhr", startMin: 720 },
  { id: "asr", startMin: 930 },
  { id: "maghrib", startMin: 1080 },
  { id: "tasbih", startMin: null },
  { id: "quran", startMin: null },
];

test("start mid-day: ticked items and items timed before the start stay; later and untimed ones switch", () => {
  // she ticked «quran» (untimed) before pressing; Dhuhr (12:00) is before 14:00 but not ticked
  const keep = boundaryKeys({ day: D, min: 840 }, D, items, { [D]: ["quran"] });
  assert.deepEqual(new Set(keep), new Set([keyOf(D, "dhuhr"), keyOf(D, "quran")]));
  const e: Excuse = { start: { day: D, min: 840 }, end: null, keepOriginal: keep, keepExcused: [] };
  assert.equal(excusedOn(e, "dhuhr", D), false); // before the start, stays the original (no fiqh judgment)
  assert.equal(excusedOn(e, "quran", D), false); // already ticked
  assert.equal(excusedOn(e, "asr", D), true);
  assert.equal(excusedOn(e, "maghrib", D), true);
  assert.equal(excusedOn(e, "tasbih", D), true); // untimed, not ticked
  // every later day: all switched; days before: nothing
  assert.equal(excusedOn(e, "dhuhr", "2026-10-21"), true);
  assert.equal(excusedOn(e, "asr", "2026-10-19"), false);
});

test("a start set to yesterday keeps what she already ticked today too", () => {
  const today = "2026-10-21";
  const keep = boundaryKeys({ day: D, min: 840 }, today, items, { [D]: [], [today]: ["dhuhr"] });
  const e: Excuse = { start: { day: D, min: 840 }, end: null, keepOriginal: keep, keepExcused: [] };
  assert.equal(excusedOn(e, "dhuhr", today), false);
  assert.equal(excusedOn(e, "asr", today), true);
});

test("end mid-day is the mirror image: ticked and earlier items stay excused, the rest return", () => {
  const E = "2026-10-26";
  // ends at 16:00; she ticked the alternative of «asr»… no: she ticked «tasbih» while excused
  const keepExcused = boundaryKeys({ day: E, min: 960 }, E, items, { [E]: ["tasbih"] });
  const e: Excuse = { start: { day: D, min: 840 }, end: { day: E, min: 960 }, keepOriginal: [], keepExcused };
  assert.equal(excusedOn(e, "dhuhr", E), true); // 12:00, before the end
  assert.equal(excusedOn(e, "asr", E), true); // 15:30, before the end
  assert.equal(excusedOn(e, "tasbih", E), true); // ticked while excused
  assert.equal(excusedOn(e, "maghrib", E), false); // after the end
  assert.equal(excusedOn(e, "quran", E), false); // untimed, not ticked
  assert.equal(excusedOn(e, "dhuhr", "2026-10-27"), false);
  assert.equal(excusedOn(e, "dhuhr", "2026-10-25"), true);
});

test("an end set to yesterday keeps today's ticks excused, and nothing else of today", () => {
  const E = "2026-10-26";
  const today = "2026-10-27";
  const keepExcused = boundaryKeys({ day: E, min: 960 }, today, items, { [today]: ["tasbih"] });
  const e: Excuse = { start: { day: D, min: 840 }, end: { day: E, min: 960 }, keepOriginal: [], keepExcused };
  assert.equal(excusedOn(e, "tasbih", today), true);
  assert.equal(excusedOn(e, "quran", today), false);
});

test("start and end on the same day: only what lies between them is excused", () => {
  const keepOriginal = boundaryKeys({ day: D, min: 840 }, D, items, {});
  const keepExcused = boundaryKeys({ day: D, min: 1000 }, D, items, {});
  const e: Excuse = { start: { day: D, min: 840 }, end: { day: D, min: 1000 }, keepOriginal, keepExcused };
  assert.equal(excusedOn(e, "dhuhr", D), false); // 12:00 < start
  assert.equal(excusedOn(e, "asr", D), true); // 15:30, between
  assert.equal(excusedOn(e, "maghrib", D), false); // 18:00 > end
  assert.equal(excusedOn(e, "tasbih", D), false); // untimed: returns at the end
});

test("item state: NONE never changes; SKIP and ALT apply only while excused", () => {
  const e: Excuse = { start: { day: D, min: 0 }, end: { day: "2026-10-22", min: 0 }, keepOriginal: [], keepExcused: [] };
  const it = (excuseMode: ExcuseMode) => ({ id: "asr", excuseMode });
  assert.equal(itemStateOn(it("NONE"), D, [e]), "ORIGINAL");
  assert.equal(itemStateOn(it("SKIP"), D, [e]), "SKIP");
  assert.equal(itemStateOn(it("ALT"), D, [e]), "ALT");
  assert.equal(itemStateOn(it("ALT"), "2026-10-23", [e]), "ORIGINAL");
  assert.equal(itemStateOn(it("SKIP"), D, []), "ORIGINAL");
});

test("scores: «لا يُحسب» leaves the day's calculation, an alternative counts as its item", () => {
  const base = { status: "APPROVED" as const, days: 127, createdDay: "2026-10-01", archivedDay: null };
  const scored: ScoredItem[] = [
    { id: "asr", value: 5, ...base },
    { id: "tasbih", value: 3, ...base },
    { id: "quran", value: 2, ...base },
  ];
  const modes = [
    { id: "asr", excuseMode: "SKIP" as const },
    { id: "tasbih", excuseMode: "ALT" as const },
    { id: "quran", excuseMode: "NONE" as const },
  ];
  const e: Excuse = { start: { day: D, min: 0 }, end: null, keepOriginal: [], keepExcused: [] };
  const skipped = skippedBy(modes, [e]);
  // she ticked the alternative (tasbih's id) and quran: everything that counts is done
  const s = dayScore(scored, new Set(["tasbih", "quran"]), D, skipped);
  assert.deepEqual(s, { day: D, possible: 5, earned: 5 });
  assert.equal(isComplete(s), true);
  // without the excuse the same ticks are 5 of 10
  assert.deepEqual(dayScore(scored, new Set(["tasbih", "quran"]), D), { day: D, possible: 10, earned: 5 });
  // a day where every item is «لا يُحسب» is neutral, never a failure
  const allSkip = skippedBy(scored.map((i) => ({ id: i.id, excuseMode: "SKIP" as const })), [e]);
  assert.equal(isComplete(dayScore(scored, new Set(), D, allSkip)), false);
  assert.equal(dayScore(scored, new Set(), D, allSkip).possible, 0);
});

test("المحصّلات: skipped days aren't due, alternatives count under their item, an all-skipped day is neutral", () => {
  const item = (id: string, value: number): SummaryItem => ({ id, title: id, value, days: 127, fromDay: "2026-10-01", untilDay: null });
  const sItems = [item("asr", 4), item("tasbih", 1)];
  const e: Excuse = { start: { day: "2026-10-19", min: 0 }, end: { day: "2026-10-21", min: 0 }, keepOriginal: [], keepExcused: [] };
  const skipped = skippedBy([{ id: "asr", excuseMode: "SKIP" }, { id: "tasbih", excuseMode: "ALT" }], [e]);
  // week 18–24 Oct; she ticks tasbih every day, asr only outside the excuse
  const checks: Record<string, string[]> = {
    "2026-10-18": ["asr", "tasbih"],
    "2026-10-19": ["tasbih"],
    "2026-10-20": ["tasbih"],
    "2026-10-21": ["asr", "tasbih"],
  };
  const sum = computeSummary({ items: sItems, checks, from: "2026-10-18", to: "2026-10-24", today: "2026-10-21", skipped });
  const asr = sum.items.find((i) => i.id === "asr")!;
  const tasbih = sum.items.find((i) => i.id === "tasbih")!;
  assert.deepEqual([asr.due, asr.done], [2, 2]); // 19th and 20th aren't due
  assert.deepEqual([tasbih.due, tasbih.done], [4, 4]); // alternative = the item
  assert.equal(sum.overall, 100);
  assert.equal(sum.completeDays, 4);
  // without the excuse she'd look like she missed two days
  const plain = computeSummary({ items: sItems, checks, from: "2026-10-18", to: "2026-10-24", today: "2026-10-21" });
  assert.ok(plain.overall! < 100);
  // an all-skipped day is a neutral tile
  const onlyAsr = computeSummary({ items: [item("asr", 4)], checks, from: "2026-10-18", to: "2026-10-24", today: "2026-10-21", skipped });
  assert.equal(onlyAsr.days.find((d) => d.day === "2026-10-19")!.state, "neutral");
});

test("15 days: it ends by itself at the same minute, and reports it once", () => {
  const e = { start: { day: "2026-10-01", min: 600 }, end: null };
  assert.equal(effectiveEnd(e, { day: "2026-10-16", min: 599 }), null);
  assert.equal(isActive(e, { day: "2026-10-16", min: 599 }), true);
  assert.deepEqual(effectiveEnd(e, { day: "2026-10-16", min: 600 }), { end: { day: "2026-10-16", min: 600 }, auto: true });
  assert.equal(isActive(e, { day: "2026-10-20", min: 0 }), false);
  const ended = { start: e.start, end: { day: "2026-10-05", min: 0 } };
  assert.deepEqual(effectiveEnd(ended, { day: "2026-10-30", min: 0 }), { end: ended.end, auto: false });
});

test("start and end times: today or yesterday, not in the future, in order", () => {
  const now = { day: "2026-10-27", min: 600 };
  assert.deepEqual(parseMoment({ day: "2026-10-26", min: 1300 }, now.day), { day: "2026-10-26", min: 1300 });
  assert.equal(parseMoment({ day: "2026-10-25", min: 10 }, now.day), null);
  assert.equal(parseMoment({ day: "2026-10-27", min: 1440 }, now.day), null);
  assert.equal(parseMoment("now", now.day), null);
  assert.equal(checkStart(null, now, null), "NO_TIME");
  assert.equal(checkStart({ day: "2026-10-27", min: 601 }, now, null), "FUTURE");
  assert.equal(checkStart({ day: "2026-10-25", min: 0 }, now, null), "TOO_EARLY");
  assert.equal(checkStart({ day: "2026-10-26", min: 500 }, now, { day: "2026-10-26", min: 900 }), "OVERLAP");
  assert.equal(checkStart({ day: "2026-10-26", min: 900 }, now, { day: "2026-10-26", min: 900 }), null);
  assert.equal(checkStart(now, now, null), null);
  const start = { day: "2026-10-26", min: 900 };
  assert.equal(checkEnd({ day: "2026-10-26", min: 900 }, now, start), "BEFORE_START");
  assert.equal(checkEnd({ day: "2026-10-26", min: 901 }, now, start), null);
  assert.equal(checkEnd({ day: "2026-10-27", min: 700 }, now, start), "FUTURE");
});

test("paused days and excuse days run from the first day to the last, both included, up to today", () => {
  assert.deepEqual([...pausedDays([{ from: "2026-10-20", to: "2026-10-22" }], "2026-10-27")], ["2026-10-20", "2026-10-21", "2026-10-22"]);
  assert.deepEqual([...pausedDays([{ from: "2026-10-26", to: null }], "2026-10-27")], ["2026-10-26", "2026-10-27"]);
  const e: Excuse = { start: { day: "2026-10-26", min: 900 }, end: null, keepOriginal: [], keepExcused: [] };
  assert.deepEqual([...excuseDays([e], "2026-10-27")], ["2026-10-26", "2026-10-27"]);
});

test("an item's setting: alternative required and at most 60 characters, gendered message", () => {
  assert.deepEqual(validateItemExcuse("SKIP", "x", "FEMALE"), { excuseMode: "SKIP", excuseAltTitle: null });
  assert.deepEqual(validateItemExcuse("ALT", "  100   تسبيحة ", "FEMALE"), { excuseMode: "ALT", excuseAltTitle: "100 تسبيحة" });
  assert.deepEqual(validateItemExcuse("ALT", " ", "FEMALE"), { error: "اكتبي البديل أولًا" });
  assert.deepEqual(validateItemExcuse("ALT", "", "MALE"), { error: "اكتب البديل أولًا" });
  assert.deepEqual(validateItemExcuse("ALT", "ا".repeat(61), null), { error: "يُرجى ألّا يزيد البديل على 60 حرفًا" });
  assert.ok("error" in validateItemExcuse("MAYBE", null, null));
});
