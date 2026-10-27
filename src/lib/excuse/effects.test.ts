import { test } from "node:test";
import assert from "node:assert/strict";
import { computeStreak as rafiqStreak, weekView } from "@/lib/rafiq/streak";
import { computeStreak as courseStreak, weekIndex } from "@/lib/students/streak";
import { computeGoal, neutralGoal, type GoalSpec } from "@/lib/goals/goal";
import { excusedDays, excusedWeeks } from "./attendance";
import { pausedDays } from "./rules";

// What a paused or excused day does to 🔥, the weekly streak and the goal —
// and that nothing changes without one.

test("🔥: a paused day is a day off — it never breaks, and a session on it still counts", () => {
  const logged = new Set(["2026-10-18", "2026-10-19", "2026-10-23", "2026-10-24"]);
  const today = "2026-10-24";
  // 20–22 missed: without a pause the streak breaks
  assert.deepEqual(rafiqStreak([], logged, today, "2026-10-18"), { current: 2, best: 2 });
  const paused = pausedDays([{ from: "2026-10-20", to: "2026-10-22" }], today);
  assert.deepEqual(rafiqStreak([], logged, today, "2026-10-18", paused), { current: 4, best: 4 });
  // the week view draws paused days as days off
  const week = weekView([], logged, today, "2026-10-18", paused);
  assert.deepEqual(
    week.map((w) => w.state),
    ["done", "done", "off", "off", "off", "done", "done"],
  );
  assert.equal(weekView([], logged, today, "2026-10-18").filter((w) => w.state === "missed").length, 3);
});

test("weekly course streak: a week with «معذورة» and no absence is neutral; with an absence it still breaks", () => {
  const day = (d: string) => new Date(`${d}T00:00:00Z`);
  const w = (d: string) => weekIndex(day(d));
  const current = w("2026-10-25");
  const group = new Set([w("2026-10-04"), w("2026-10-11"), w("2026-10-18"), current]);
  const student = new Set([w("2026-10-04"), w("2026-10-18"), current]);
  // week of 11 Oct: not present
  assert.equal(courseStreak(student, group, current), 2);
  const excused = excusedWeeks([{ day: day("2026-10-12"), status: "EXCUSED" }]);
  assert.equal(courseStreak(student, group, current, excused), 3);
  const mixed = excusedWeeks([
    { day: day("2026-10-12"), status: "EXCUSED" },
    { day: day("2026-10-14"), status: "OUT" },
  ]);
  assert.equal(mixed.size, 0);
  assert.equal(courseStreak(student, group, current, mixed), 2);
  assert.deepEqual([...excusedDays([{ day: day("2026-10-12"), status: "EXCUSED" }, { day: day("2026-10-13"), status: "IN" }])], ["2026-10-12"]);
});

// Al-Mulk (67) is 30 ayat, about 2.9 pages; a 30-day goal from 1 Oct.
const plan = [67];
const spec: GoalSpec = { target: "PLAN", juz: null, surah: null, ayah: null, startDay: "2026-10-01", deadline: "2026-10-30" };

test("goal without paused days: unchanged (and never marked paused)", () => {
  const v = computeGoal(plan, spec, [], "2026-10-21");
  assert.equal(v.state, "ACTIVE");
  if (v.state !== "ACTIVE") return;
  assert.equal(v.daysLeft, 10);
  assert.equal(v.status, "BEHIND");
  assert.equal(v.paused, false);
});

test("goal: the deadline stays, paused days don't count, today paused is never «متأخرة»", () => {
  const sessions = [{ surahNumber: 67, fromAyah: 1, toAyah: 17, type: "NEW" as const, day: "2026-10-10", prior: false }];
  const today = "2026-10-20";
  // 14–20 paused (a week)
  const paused = pausedDays([{ from: "2026-10-14", to: null }], today);
  const v = computeGoal(plan, spec, sessions, today, paused);
  assert.equal(v.state, "ACTIVE");
  if (v.state !== "ACTIVE") return;
  assert.equal(v.deadline, "2026-10-30");
  assert.equal(v.paused, true);
  assert.notEqual(v.status, "BEHIND");
  // the 10 days after today (21–30) share what's left
  assert.equal(v.daysLeft, 10);

  // back from the pause the next day: the rest is spread over the days left
  const after = computeGoal(plan, spec, sessions, "2026-10-21", pausedDays([{ from: "2026-10-14", to: "2026-10-20" }], "2026-10-21"));
  assert.equal(after.state, "ACTIVE");
  if (after.state !== "ACTIVE") return;
  assert.equal(after.paused, false);
  assert.equal(after.daysLeft, 10);
  // the straight line waited (13 of 23 counted days): on track, where without the pause she'd be behind
  assert.equal(after.status, "ON_TRACK");
  const plain = computeGoal(plan, spec, sessions, "2026-10-21");
  assert.equal(plain.state === "ACTIVE" && plain.status, "BEHIND");
});

// ---------- what a viewer who may not see her excuse sees of her goal ----------

const paused14to20 = (today: string) => pausedDays([{ from: "2026-10-14", to: "2026-10-20" }], today);

test("neutral goal: «متأخرة» before the pause stays «متأخرة» while it lasts — she herself sees «على المسار»", () => {
  // nothing memorized: behind by the 13th
  const before = computeGoal(plan, spec, [], "2026-10-13");
  assert.ok(before.state === "ACTIVE" && before.status === "BEHIND");
  const hers = computeGoal(plan, spec, [], "2026-10-16", paused14to20("2026-10-16"));
  const theirs = neutralGoal(plan, spec, [], "2026-10-16", paused14to20("2026-10-16"));
  assert.ok(hers.state === "ACTIVE" && hers.status !== "BEHIND" && hers.paused);
  assert.ok(theirs.state === "ACTIVE");
  if (theirs.state !== "ACTIVE" || before.state !== "ACTIVE") return;
  assert.equal(theirs.status, "BEHIND");
  // the daily amount as on the 13th, the days left counted plainly (16th–30th), never marked paused
  assert.equal(theirs.dailyQuarter, before.dailyQuarter);
  assert.equal(theirs.dailyAyat, before.dailyAyat);
  assert.equal(theirs.daysLeft, 15);
  assert.equal(theirs.paused, false);
});

test("neutral goal: «على المسار» before the pause stays so; after it, the computed values again", () => {
  const sessions = [{ surahNumber: 67, fromAyah: 1, toAyah: 17, type: "NEW" as const, day: "2026-10-10", prior: false }];
  const before = computeGoal(plan, spec, sessions, "2026-10-13");
  const during = neutralGoal(plan, spec, sessions, "2026-10-18", paused14to20("2026-10-18"));
  assert.ok(before.state === "ACTIVE" && during.state === "ACTIVE");
  if (before.state !== "ACTIVE" || during.state !== "ACTIVE") return;
  assert.equal(during.status, before.status);
  assert.equal(during.dailyQuarter, before.dailyQuarter);
  // the 21st: back to what the goal computes (the line waited during the pause)
  const after = neutralGoal(plan, spec, sessions, "2026-10-21", paused14to20("2026-10-21"));
  assert.deepEqual(after, computeGoal(plan, spec, sessions, "2026-10-21", paused14to20("2026-10-21")));
  // and without any pause, exactly computeGoal
  assert.deepEqual(neutralGoal(plan, spec, sessions, "2026-10-18"), computeGoal(plan, spec, sessions, "2026-10-18"));
});

test("neutral goal: a pause from the goal's first day has nothing to freeze — the current values, never paused", () => {
  const p = pausedDays([{ from: "2026-10-01", to: null }], "2026-10-03");
  const v = neutralGoal(plan, spec, [], "2026-10-03", p);
  assert.ok(v.state === "ACTIVE" && v.paused === false && v.daysLeft === 28);
});
