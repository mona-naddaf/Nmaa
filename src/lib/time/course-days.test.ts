// The course features' day logic around midnight, for Riyadh, Rabat and a
// far-east zone, plus the after-midnight save bug (a session or point dated
// «today» in Riyadh was rejected as a future date between 00:00 and 03:00).
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseDateOnlyInput } from "@/lib/attendance";
import { computeOverdueSurahs } from "@/lib/students/review";
import { weekIndex } from "@/lib/students/streak";
import { courseGoalSessions } from "@/lib/goals/data";
import { computeGoal } from "@/lib/goals/goal";
import { sheetDateProblem, sheetOccurredAt } from "@/lib/offline-sheet/dates";
import { acceptCourseTickDay, localDayOf, withLocalDays } from "@/lib/tracker/rules";
import { toHijri } from "@/lib/calendar/hijri";
import { backdatedAt, dateOnly, zoneDateOnly, zoneDateOnlyOf, zoneDayOf, zoneDayRange, zoneToday } from "./zone";

const AT_2130 = new Date("2026-10-14T21:30:00Z");
const AT_2330 = new Date("2026-10-14T23:30:00Z");
const RIYADH = "Asia/Riyadh";
const RABAT = "Africa/Casablanca";
const AUCKLAND = "Pacific/Auckland";

test("after-midnight save: the date the form shows is accepted by the server (was rejected as «future»)", () => {
  for (const now of [AT_2130, AT_2330]) {
    for (const tz of [RIYADH, RABAT, AUCKLAND]) {
      // the student page renders the course's today and the form sends it back
      const formDate = zoneToday(tz, now);
      const day = parseDateOnlyInput(formDate, tz, now);
      assert.ok(day, `${tz} ${now.toISOString()} rejected ${formDate}`);
      // and it's today, so the session is stored at "now" (not backdated)
      assert.equal(day!.getTime(), zoneDateOnly(tz, now).getTime());
      // the day after stays rejected
      const tomorrow = new Date(day!.getTime() + 86400000).toISOString().slice(0, 10);
      assert.equal(parseDateOnlyInput(tomorrow, tz, now), null, `${tz} accepted ${tomorrow}`);
    }
  }
  // Riyadh at 00:30 (21:30 UTC): the 15th is today
  assert.ok(parseDateOnlyInput("2026-10-15", RIYADH, AT_2130));
  // Rabat at 22:30 (21:30 UTC): still the 14th, the 15th is the future
  assert.equal(parseDateOnlyInput("2026-10-15", RABAT, AT_2130), null);
  assert.ok(parseDateOnlyInput("2026-10-15", RABAT, AT_2330));
});

test("attendance and points are stored on the course's day", () => {
  assert.equal(zoneDateOnly(RIYADH, AT_2130).toISOString(), "2026-10-15T00:00:00.000Z");
  assert.equal(zoneDateOnly(RABAT, AT_2130).toISOString(), "2026-10-14T00:00:00.000Z");
  assert.equal(zoneDateOnly(RABAT, AT_2330).toISOString(), "2026-10-15T00:00:00.000Z");
  assert.equal(zoneDateOnly(AUCKLAND, AT_2130).toISOString(), "2026-10-15T00:00:00.000Z");
});

test("history / leaderboard: a session belongs to the course's day it happened", () => {
  assert.equal(zoneDayOf(RIYADH, AT_2130), "2026-10-15");
  assert.equal(zoneDayOf(RABAT, AT_2130), "2026-10-14");
  assert.equal(zoneDayOf(RABAT, AT_2330), "2026-10-15");
  assert.equal(zoneDayOf(AUCKLAND, AT_2130), "2026-10-15");
  // a backdated session lands on its day in every zone
  for (const tz of [RIYADH, RABAT, AUCKLAND]) assert.equal(zoneDayOf(tz, backdatedAt(tz, "2026-10-12")), "2026-10-12");
});

test("reports: a day range covers exactly the sessions of those course days", () => {
  const inRange = (tz: string, at: Date) => {
    const r = zoneDayRange(tz, "2026-10-01", "2026-10-14");
    return at >= r.gte && at < r.lt;
  };
  assert.equal(inRange(RIYADH, AT_2130), false); // the 15th in Riyadh
  assert.equal(inRange(RABAT, AT_2130), true); // still the 14th in Rabat
  assert.equal(inRange(RABAT, AT_2330), false);
  assert.equal(inRange(AUCKLAND, new Date("2026-10-14T10:30:00Z")), true); // 23:30 on the 14th there
  assert.equal(inRange(AUCKLAND, AT_2130), false);
  assert.equal(inRange(RIYADH, new Date("2026-09-30T21:00:00Z")), true); // 00:00 on Oct 1st in Riyadh
});

test("streaks: Saturday night after midnight is the next week in Riyadh, the same week in Rabat", () => {
  // Saturday 2026-10-17 21:30 UTC = Sunday 00:30 in Riyadh, Saturday 22:30 in Rabat
  const sat = new Date("2026-10-17T21:30:00Z");
  const satWeek = weekIndex(dateOnly("2026-10-17"));
  assert.equal(weekIndex(zoneDateOnlyOf(RIYADH, sat)), satWeek + 1);
  assert.equal(weekIndex(zoneDateOnlyOf(RABAT, sat)), satWeek);
  // and "this week" follows the zone's today
  assert.equal(weekIndex(zoneDateOnly(RIYADH, sat)), satWeek + 1);
  assert.equal(weekIndex(zoneDateOnly(RABAT, sat)), satWeek);
});

test("review reminder: days since the last review count on the course's days", () => {
  // Al-Kawthar (108, 3 ayat) memorized on 2026-10-01 at 21:30 UTC, never reviewed
  const sessions = [{ surahNumber: 108, fromAyah: 1, toAyah: 3, type: "NEW" as const, occurredAt: new Date("2026-10-01T21:30:00Z") }];
  const overdue = (tz: string, now: Date) =>
    computeOverdueSurahs(sessions, 12, zoneToday(tz, now), (s) => zoneDayOf(tz, s.occurredAt));
  // Riyadh: memorized on the 2nd; at 00:30 on the 15th that's 13 days > 12
  assert.deepEqual(overdue(RIYADH, AT_2130).map((o) => [o.since, o.daysSince]), [["2026-10-02", 13]]);
  // Rabat: memorized on the 1st; at 22:30 on the 14th that's 13 days; at 00:30 on the 15th, 14
  assert.deepEqual(overdue(RABAT, AT_2130).map((o) => [o.since, o.daysSince]), [["2026-10-01", 13]]);
  assert.deepEqual(overdue(RABAT, AT_2330).map((o) => [o.since, o.daysSince]), [["2026-10-01", 14]]);
  // not yet overdue in Riyadh at 20:30 UTC on the 14th (23:30 there: 12 days)
  assert.deepEqual(overdue(RIYADH, new Date("2026-10-14T20:30:00Z")), []);
});

test("goal: today's share and «today done» follow the course's day", () => {
  const plan = [114, 113, 112];
  const spec = { target: "PLAN" as const, juz: null, surah: null, ayah: null, startDay: "2026-10-10", deadline: "2026-10-20" };
  const session = { surahNumber: 114, fromAyah: 1, toAyah: 6, type: "NEW" as const, source: "LOGGED", occurredAt: AT_2130 };
  // Riyadh: recited at 00:30 on the 15th → counts for today (the 15th)
  const riyadh = computeGoal(plan, spec, courseGoalSessions([session], RIYADH), zoneToday(RIYADH, AT_2130));
  // Rabat: recited at 22:30 on the 14th → at 00:30 on the 15th it was yesterday
  const rabat = computeGoal(plan, spec, courseGoalSessions([session], RABAT), zoneToday(RABAT, AT_2330));
  assert.equal(riyadh.state, "ACTIVE");
  assert.equal(rabat.state, "ACTIVE");
  if (riyadh.state === "ACTIVE" && rabat.state === "ACTIVE") {
    assert.ok(riyadh.doneToday > 0);
    assert.equal(rabat.doneToday, 0);
  }
});

test("offline sheet: today, the 30-day window and stored times use the course's day", () => {
  // Riyadh at 00:30 on the 15th: a file dated the 15th is today, not the future
  assert.equal(sheetDateProblem(dateOnly("2026-10-15"), RIYADH, AT_2130), null);
  assert.equal(sheetDateProblem(dateOnly("2026-10-15"), RABAT, AT_2130), "تاريخ الملف في المستقبل");
  assert.equal(sheetDateProblem(dateOnly("2026-10-15"), RABAT, AT_2330), null);
  assert.equal(sheetDateProblem(dateOnly("2026-09-15"), RIYADH, AT_2130), null); // 30 days back
  assert.match(sheetDateProblem(dateOnly("2026-09-14"), RIYADH, AT_2130) ?? "", /أقدم من 30/);
  assert.equal(sheetDateProblem(dateOnly("2026-09-14"), RABAT, AT_2130), null); // still the 14th there
  // today: stored at now (+i ms), so it falls on today in the zone
  for (const tz of [RIYADH, RABAT, AUCKLAND]) {
    const today = dateOnly(zoneToday(tz, AT_2330));
    const at = sheetOccurredAt(today, 2, tz, AT_2330);
    assert.equal(at.getTime(), AT_2330.getTime() + 2);
    assert.equal(zoneDayOf(tz, at), zoneToday(tz, AT_2330));
    // a past day: on that day in the zone
    assert.equal(zoneDayOf(tz, sheetOccurredAt(dateOnly("2026-10-12"), 0, tz, AT_2330)), "2026-10-12");
  }
  // Riyadh/Rabat past day: noon UTC + i seconds, as before
  assert.equal(sheetOccurredAt(dateOnly("2026-10-12"), 3, RIYADH, AT_2330).toISOString(), "2026-10-12T12:00:03.000Z");
});

test("tracker: ticks on the course's today or yesterday; items exist from the course's day", () => {
  const today = zoneToday(RIYADH, AT_2130); // 2026-10-15
  assert.equal(acceptCourseTickDay("2026-10-15", today), "2026-10-15");
  assert.equal(acceptCourseTickDay("2026-10-14", today), "2026-10-14");
  assert.equal(acceptCourseTickDay("2026-10-13", today), null);
  assert.equal(acceptCourseTickDay("2026-10-16", today), null);
  assert.equal(acceptCourseTickDay(undefined, today), null);
  const item = { id: "x", value: 1, status: "APPROVED" as const, days: 127, createdDay: "", archivedDay: null, createdAt: AT_2130.toISOString(), archivedAt: null };
  assert.equal(withLocalDays([item], RIYADH)[0].createdDay, "2026-10-15");
  assert.equal(withLocalDays([item], RABAT)[0].createdDay, "2026-10-14");
  assert.equal(localDayOf(AT_2330.toISOString(), AUCKLAND), "2026-10-15");
});

test("Hijri calendar: «today» follows the course's day", () => {
  const riyadh = toHijri(zoneToday(RIYADH, AT_2130));
  const rabat = toHijri(zoneToday(RABAT, AT_2130));
  assert.equal(zoneToday(RIYADH, AT_2130), "2026-10-15");
  assert.equal(zoneToday(RABAT, AT_2130), "2026-10-14");
  assert.notDeepEqual(riyadh, rabat);
  assert.deepEqual(toHijri("2026-10-15"), riyadh);
});

test("Riyadh in normal hours: the save path, sheet times and review days match the old code", () => {
  // the old code, as it was (server on UTC)
  const oldToday = (now: Date) => new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const oldBackdated = (day: Date) => new Date(day.getTime() + 12 * 60 * 60 * 1000);
  const oldSheetOccurredAt = (day: Date, i: number, now: Date) => {
    const utcToday = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
    if (day.getTime() === utcToday) return new Date(now.getTime() + i);
    if (day.getTime() > utcToday) return new Date(day.getTime() + i * 1000);
    return new Date(day.getTime() + 12 * 60 * 60 * 1000 + i * 1000);
  };
  for (let d = 0; d < 60; d += 3) {
    for (const hour of [3, 6, 9, 12, 15, 18, 20]) {
      const now = new Date(Date.UTC(2026, 9, 1 + d, hour, 17));
      assert.equal(zoneDateOnly(RIYADH, now).getTime(), oldToday(now).getTime());
      for (const back of [0, 1, 5, 29]) {
        const day = new Date(oldToday(now).getTime() - back * 86400000);
        const iso = day.toISOString().slice(0, 10);
        assert.deepEqual(parseDateOnlyInput(iso, RIYADH, now), day);
        if (back > 0) assert.equal(backdatedAt(RIYADH, day).getTime(), oldBackdated(day).getTime());
        assert.equal(sheetOccurredAt(day, 4, RIYADH, now).getTime(), oldSheetOccurredAt(day, 4, now).getTime());
      }
    }
  }
});
