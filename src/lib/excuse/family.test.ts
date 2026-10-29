import { test } from "node:test";
import assert from "node:assert/strict";
import { excuseLens, hiddenOn, quietLens } from "./lens";
import { quietHome } from "./home-quiet";
import { computeGoal } from "@/lib/goals/goal";
import { computeStreak } from "@/lib/rafiq/streak";
import { keyOf, type Excuse } from "./rules";

// A girl's excuse in «العائلة» for an adult not checked in her list: her
// tracker leaves out what wasn't due, and her 🔥 and goal come as results —
// the same scores, and nothing of the excuse.

const items = [
  { id: "quran", excuseMode: "SKIP" as const, excuseAltTitle: null },
  { id: "asr", excuseMode: "ALT" as const, excuseAltTitle: "100 تسبيحة" },
];
const open: Excuse = { start: { day: "2026-10-20", min: 0 }, end: null, keepOriginal: [], keepExcused: [] };

test("quiet tracker: only what isn't due, left out of the day; no alternative, no excuse day", () => {
  const full = excuseLens(items, [open], { day: "2026-10-22", min: 600 });
  const notDue = ["2026-10-20", "2026-10-21", "2026-10-22"].flatMap((d) => items.filter((i) => full.skipped(i.id, d)).map((i) => keyOf(d, i.id)));
  assert.deepEqual(notDue, ["2026-10-20:quran", "2026-10-21:quran", "2026-10-22:quran"]);
  const quiet = quietLens(notDue);
  // the same scores
  for (const d of ["2026-10-19", "2026-10-21"]) for (const i of items) assert.equal(quiet.skipped(i.id, d), full.skipped(i.id, d));
  // nothing else of it: the alternative looks like its item, no excuse day
  assert.deepEqual(quiet.view("asr", "2026-10-21"), { state: "ORIGINAL", alt: null });
  assert.equal(quiet.isExcuseDay("2026-10-21"), false);
  // the item simply isn't there that day — but only for a quiet viewer
  assert.equal(hiddenOn(quiet, "quran", "2026-10-21"), true);
  assert.equal(hiddenOn(quiet, "quran", "2026-10-19"), false);
  assert.equal(hiddenOn(full, "quran", "2026-10-21"), false);
});

// a girl who memorizes every day: logged to the 13th, paused 14th–20th, back on the 21st
const logged = ["2026-10-10", "2026-10-11", "2026-10-12", "2026-10-13", "2026-10-21"];
const home = {
  plan: [67],
  goal: { target: "PLAN" as const, juz: null, surah: null, ayah: null, startDay: "2026-10-01", deadline: "2026-10-30" },
  sessions: [
    ...logged.map((day) => ({ surahNumber: 67, fromAyah: 1, toAyah: 2, type: "NEW" as const, day, prior: false })),
    { surahNumber: 67, fromAyah: 3, toAyah: 17, type: "NEW" as const, day: "2026-10-10", prior: false },
  ],
  schedule: [{ from: "2026-10-01", days: 127 }],
  loggedDays: logged,
  createdAt: "2026-10-01T08:00:00.000Z",
};
const pauses = [{ from: "2026-10-14", to: "2026-10-20" }];

test("quiet «صفحتي»: 🔥 unbroken, goal as before the pause, no paused day sent", () => {
  const q = quietHome(home, pauses, "2026-10-19");
  assert.deepEqual(Object.keys(q.goalBy), ["2026-10-18", "2026-10-19", "2026-10-20"]);
  // on a paused day her goal is as it was on the 13th
  const was = computeGoal(home.plan, home.goal, home.sessions, "2026-10-13");
  const now = q.goalBy["2026-10-19"];
  assert.ok(now?.state === "ACTIVE" && was.state === "ACTIVE");
  if (now?.state === "ACTIVE" && was.state === "ACTIVE") {
    assert.equal(now.status, was.status);
    assert.equal(now.dailyQuarter, was.dailyQuarter);
    assert.equal(now.paused, false);
  }
  // 🔥 not broken by the paused days (without them it would be)
  const back = quietHome(home, pauses, "2026-10-21").streakBy["2026-10-21"];
  assert.equal(back.current, 5);
  assert.ok(computeStreak(home.schedule, new Set(logged), "2026-10-21", "2026-10-10").current < 5);
  // paused days look like any day off
  assert.ok(back.week.filter((w) => w.day >= "2026-10-14" && w.day <= "2026-10-20").every((w) => w.state === "off"));
  // nothing says it's paused
  assert.ok(!/paused":true|pause[sd]?"/i.test(JSON.stringify(q).replace(/"paused":false/g, "")));
});
