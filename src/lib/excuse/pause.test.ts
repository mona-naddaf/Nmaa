import { test } from "node:test";
import assert from "node:assert/strict";
import { buildDashboard, type DashFacts, type DashRows } from "@/lib/family/dashboard-build";

// Her family's dashboard while she paused her memorization: her 🔥 isn't
// broken and her goal isn't «متأخرة» — and nothing in what leaves the server
// says why.

const facts: DashFacts = {
  familyId: "f",
  siblingsVisible: false,
  children: [],
  adults: [
    { id: "mona", name: "منى", gender: "FEMALE", createdAt: new Date("2026-10-01T08:00:00Z"), planChangedAt: null, shareProgress: true, shareTracker: false },
    { id: "ahmad", name: "أحمد", gender: "MALE", createdAt: new Date("2026-10-01T08:00:00Z"), planChangedAt: null, shareProgress: false, shareTracker: false },
  ],
};
const T = (d: string) => new Date(`${d}T00:00:00Z`);
const logged = (d: string) => ({ userId: "mona", source: "LOGGED" as const, type: "NEW" as const, surahNumber: 67, fromAyah: 1, toAyah: 2, situation: null, reason: null, createdAt: T(d), day: T(d) });
// sessions every day to the 13th, then nothing 14–20 (paused), back on the 21st
const days = ["2026-10-10", "2026-10-11", "2026-10-12", "2026-10-13", "2026-10-21"];
const rows: DashRows = {
  planItems: [{ userId: "mona", surahNumber: 67, position: 0 }],
  sessions: [...days.map(logged), { ...logged("2026-10-10"), fromAyah: 3, toAyah: 17 }],
  goals: [{ userId: "mona", target: "PLAN", juz: null, surah: null, ayah: null, startDay: T("2026-10-01"), deadline: T("2026-10-30") }],
  commitDays: [],
  trackerItems: [],
  checks: [],
};
const paused = ["2026-10-14", "2026-10-15", "2026-10-16", "2026-10-17", "2026-10-18", "2026-10-19", "2026-10-20"];
const now = new Date("2026-10-21T10:00:00Z");
const viewer = { kind: "ADULT" as const, id: "ahmad" };

test("dashboard: a woman's paused days don't break her 🔥 or make her «متأخرة», and aren't sent", () => {
  const plain = buildDashboard(viewer, facts, rows, now).adults[0].progress!;
  const quiet = buildDashboard(viewer, facts, { ...rows, paused: { mona: paused } }, now).adults[0].progress!;
  // results only, for each day that may be the viewer's today
  assert.equal(quiet.goal, undefined);
  assert.equal(quiet.streak, undefined);
  assert.deepEqual(Object.keys(quiet.streakBy!), ["2026-10-20", "2026-10-21", "2026-10-22"]);
  // without the pause the week off broke it; with it, 13th → 21st runs on (5 days logged)
  assert.equal(quiet.streakBy!["2026-10-21"].current, 5);
  assert.ok(plain.streak);
  const goal = quiet.goalBy!["2026-10-21"];
  assert.equal(goal?.state, "ACTIVE");
  if (goal?.state === "ACTIVE") {
    assert.notEqual(goal.status, "BEHIND");
    assert.equal(goal.paused, false);
  }
  // on a paused day: never «متأخرة», and still nothing says it's paused
  const onPausedDay = buildDashboard(viewer, facts, { ...rows, paused: { mona: paused } }, new Date("2026-10-19T10:00:00Z")).adults[0].progress!.goalBy!["2026-10-19"];
  assert.ok(onPausedDay?.state === "ACTIVE" && onPausedDay.status !== "BEHIND" && onPausedDay.paused === false);
  // no paused day in what leaves the server (the 20th is only there as a possible «today»)
  const out = JSON.stringify(quiet);
  for (const d of paused.slice(0, -1)) assert.ok(!out.includes(d), d);
  assert.ok(!/paused":true|excuse|pause[sd]?"/i.test(out.replace(/"paused":false/g, "")));
});

test("dashboard: a woman with no pause gets the same numbers as before, as results", () => {
  const plain = buildDashboard(viewer, facts, rows, now).adults[0].progress!;
  const quiet = buildDashboard(viewer, facts, { ...rows, paused: { mona: [] } }, now).adults[0].progress!;
  assert.equal(quiet.streakBy!["2026-10-21"].current, 1);
  assert.ok(plain.goal && quiet.goalBy!["2026-10-21"]);
});
