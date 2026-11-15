import { test } from "node:test";
import assert from "node:assert/strict";
import { addDays, fromHijri, weekday } from "@/lib/calendar/hijri";
import { totalsOf } from "./totals";
import { estimate, parseEstimate, parsePreview, prayerDays } from "./estimate";
import { availableDays } from "./available";
import { fastPaceFinish, fastPerWeek, prayerPaceFinish, prayerQuota, standing } from "./distribute";
import { blockedFastDays, fastSuggestions } from "./fasting-days";
import { nextMilestone } from "./milestones";
import { qadaAccess } from "./visibility";
import { fastPlan, prayerPlan, type DayRow, type Goal } from "./plan";

const five = (n: number) => ({ FAJR: n, DHUHR: n, ASR: n, MAGHRIB: n, ISHA: n });

test("totals: from the log; done beyond what's owed of one prayer doesn't count for another", () => {
  const t = totalsOf([
    { kind: "FAJR", action: "OWED", count: 10 },
    { kind: "DHUHR", action: "OWED", count: 10 },
    { kind: "FAJR", action: "MADE_UP", count: 14 },
    { kind: "FAST", action: "OWED", count: 6 },
    { kind: "FAST", action: "MADE_UP", count: 3 },
  ]);
  assert.deepEqual(t.FAJR, { owed: 10, done: 14, remaining: 0 });
  assert.equal(t.prayers.remaining, 10);
  assert.equal(t.prayers.pct, 50);
  assert.equal(t.fast.pct, 50);
  assert.equal(totalsOf([]).prayers.pct, 0);
});

test("estimate: 30-day months, Ramadan left out per whole year, her excuse days off every month counted", () => {
  // 2 years 6 months = 30 months, 2 Ramadans out → 28 × 30
  assert.equal(prayerDays({ years: 2, months: 6, excludeRamadan: true, excuseDays: null }), 840);
  assert.equal(prayerDays({ years: 2, months: 6, excludeRamadan: false, excuseDays: null }), 900);
  // a woman with 7 days: 28 × 23
  assert.equal(prayerDays({ years: 2, months: 6, excludeRamadan: true, excuseDays: 7 }), 644);
  const woman = estimate({ prayers: ["FAJR"], years: 1, months: 0, excludeRamadan: true, excuseDays: 6, ramadans: 3, fastDays: 99 });
  assert.deepEqual(woman, { prayers: { FAJR: 11 * 24 }, fast: 18 });
  const man = estimate({ prayers: ["FAJR", "ISHA"], years: 0, months: 0, excludeRamadan: true, excuseDays: null, ramadans: 5, fastDays: 12 });
  assert.deepEqual(man, { prayers: {}, fast: 12 });
});

test("estimate: answers are checked; a man's excuse answers are ignored", () => {
  assert.equal(parseEstimate({ prayers: ["FAJR"], years: 1, months: 12, excuseDays: 5, ramadans: 1 }, true), null);
  assert.equal(parseEstimate({ prayers: ["FAJR"], years: 1, months: 2, ramadans: 1 }, true), null); // she must answer the excuse question
  assert.equal(parseEstimate({ prayers: ["SUNRISE"], years: 1, months: 2, excuseDays: 5, ramadans: 1 }, true), null);
  const m = parseEstimate({ prayers: ["ISHA", "FAJR"], years: "3", months: 0, excuseDays: 9, ramadans: 4, fastDays: 20 }, false);
  assert.deepEqual(m, { prayers: ["FAJR", "ISHA"], years: 3, months: 0, excludeRamadan: true, excuseDays: null, ramadans: 0, fastDays: 20 });
  assert.deepEqual(parsePreview({ prayers: { FAJR: 5, DHUHR: 0 }, fast: 3 }), { prayers: { FAJR: 5 }, fast: 3 });
  assert.equal(parsePreview({ prayers: { FAJR: -1 } }), null);
  assert.equal(parsePreview({ prayers: { SUNRISE: 1 } }), null);
});

test("available: a man has every day; a woman's expected excuse days come off from the start", () => {
  assert.deepEqual(availableDays({ today: "2026-01-01", deadline: "2026-01-30", from: "2026-01-01", avg: null, excuses: null }), { calendar: 30, excuse: 0, days: 30 });
  const w = availableDays({ today: "2026-01-01", deadline: "2026-01-30", from: "2026-01-01", avg: 7, excuses: null });
  assert.equal(w.days, 23);
  assert.equal(availableDays({ today: "2026-02-01", deadline: "2026-01-30", from: "2026-01-01", avg: 7, excuses: null }).days, 0);
});

/** 300 days, average 7: she makes up exactly the amount each day she isn't excused. */
function simulate(excuses: { start: number; len: number }[], upto: number) {
  const from = "2026-01-01";
  const deadline = addDays(from, 299);
  const rate0 = 2300 / availableDays({ today: from, deadline, from, avg: 7, excuses: [] }).days; // = 10 a day
  let left = 2300;
  const rates: number[] = [];
  for (let d = 0; d < upto; d++) {
    const today = addDays(from, d);
    const spans = excuses.filter((e) => e.start < d).map((e) => ({ start: addDays(from, e.start), end: addDays(from, Math.min(e.start + e.len - 1, d - 1)) }));
    const av = availableDays({ today, deadline, from, avg: 7, excuses: spans });
    const rate = left / av.days;
    rates.push(rate);
    const excused = excuses.some((e) => d >= e.start && d < e.start + e.len);
    if (!excused) left -= rate0;
  }
  return { rate0, rates };
}

test("available: after an excuse of her usual length, today's amount is the same — no catching up", () => {
  const { rate0, rates } = simulate([{ start: 23, len: 7 }, { start: 53, len: 7 }, { start: 83, len: 7 }], 100);
  assert.ok(Math.abs(rate0 - 10) < 1e-9);
  for (const d of [30, 31, 60, 61, 90, 91]) assert.ok(Math.abs(rates[d] - 10) < 0.05, `day ${d}: ${rates[d]}`);
  // an excuse right at the start: the same
  const early = simulate([{ start: 0, len: 7 }], 10);
  assert.ok(Math.abs(early.rates[7] - 10) < 0.05, `${early.rates[7]}`);
});

test("available: a much longer excuse raises the amount a little (only the extra days)", () => {
  const { rates } = simulate([{ start: 23, len: 15 }], 40);
  // 15 days instead of 7: 8 days beyond her average, 3 of them forgiven
  assert.ok(rates[38] > 10.1 && rates[38] < 11, `${rates[38]}`);
});

test("available: fasting leaves out the blocked days", () => {
  const blocked = new Set(["2026-01-02", "2026-01-03"]);
  assert.equal(availableDays({ today: "2026-01-01", deadline: "2026-01-10", from: "2026-01-01", avg: null, excuses: null, blocked }).days, 8);
});

test("prayer quota: rounded up, shared by what's left of each prayer", () => {
  const q = prayerQuota({ FAJR: 300, DHUHR: 100, ASR: 100, MAGHRIB: 0, ISHA: 0 }, 100);
  assert.equal(q.total, 5);
  assert.deepEqual(q.per, { FAJR: 3, DHUHR: 1, ASR: 1, MAGHRIB: 0, ISHA: 0 });
  const q2 = prayerQuota(five(10), 7); // 50 / 7 = 7.14 → 8
  assert.equal(q2.total, 8);
  assert.equal(Object.values(q2.per).reduce((a, b) => a + b, 0), 8);
  assert.ok(Object.values(q2.per).every((n) => n === 1 || n === 2));
  // never more than what's left, nor past the deadline's whole
  assert.deepEqual(prayerQuota({ FAJR: 2, DHUHR: 0, ASR: 0, MAGHRIB: 0, ISHA: 0 }, 0).per.FAJR, 2);
  assert.equal(prayerQuota(five(0), 10).total, 0);
});

test("pace: finish dates count her excuse days in between", () => {
  assert.equal(prayerPaceFinish(five(10), 2, "2026-01-01", null), "2026-01-05");
  // 23 days of qada with 7 excuse days a month → 30 calendar days
  assert.equal(prayerPaceFinish({ ...five(0), FAJR: 46 }, 2, "2026-01-01", 7), "2026-01-30");
  assert.equal(prayerPaceFinish(five(0), 2, "2026-01-01", 7), null);
  assert.equal(fastPaceFinish(4, 2, "2026-01-01", null, () => false), "2026-01-14");
  assert.equal(fastPaceFinish(1, 7, "2026-01-01", null, (d) => d === "2026-01-01"), "2026-01-02");
  // a week's worth: 7 days a week over 30 days with no excuse days → 30 per 30 days
  assert.ok(Math.abs(fastPerWeek(30, 30, null) - 7) < 1e-9);
  // with 7 excuse days a month, every available day is ~5.4 a calendar week
  assert.ok(Math.abs(fastPerWeek(23, 23, 7) - (7 * 23) / 30) < 1e-9);
});

test("standing: ahead under 85% of the start, the extend line past twice it; never 'behind'", () => {
  assert.equal(standing(4, 5), "ahead");
  assert.equal(standing(5.5, 5), "even");
  assert.equal(standing(10.5, 5), "extend");
  assert.equal(standing(3, null), "even");
});

test("fasting days left out: Ramadan, both Eids, 11–13 ذو الحجة and the last day of شعبان", () => {
  const ramadan = fromHijri(1448, 9, 1)!;
  const fitr = fromHijri(1448, 10, 1)!;
  const adha = fromHijri(1448, 12, 10)!;
  const b = blockedFastDays(addDays(ramadan, -40), addDays(adha, 10));
  assert.ok(b.has(addDays(ramadan, -1)));
  assert.ok(!b.has(addDays(ramadan, -2)));
  assert.ok(b.has(ramadan) && b.has(addDays(fitr, -1)) && b.has(fitr));
  assert.ok(!b.has(addDays(fitr, 1)));
  for (let i = 0; i <= 3; i++) assert.ok(b.has(addDays(adha, i)));
  assert.ok(!b.has(addDays(adha, 4)) && !b.has(addDays(adha, -1)));
  // a moon-sighting shift moves the Eid with it
  const shifted = blockedFastDays(fitr, addDays(fitr, 3), [{ occasion: "EID_FITR", hijriYear: 1448, offsetDays: 1 }]);
  assert.ok(shifted.has(addDays(fitr, 1)));
});

test("fasting suggestions: Mondays, Thursdays and الأيام البيض, never a day left out", () => {
  const s = fastSuggestions("2026-11-15", 14, new Set(), 10);
  assert.ok(s.length > 0);
  for (const x of s) {
    const w = weekday(x.day);
    assert.ok(x.reasons.includes("WHITE") || w === 1 || w === 4);
  }
  const all = fastSuggestions("2026-11-15", 14, new Set(s.map((x) => x.day)), 10);
  assert.equal(all.length, 0);
});

test("milestones: each once, only the highest just reached; again after more owed past 100%", () => {
  let st = { shown: 0, at: 0 };
  let r = nextMilestone(30, 100, st);
  assert.equal(r.show, 25);
  st = r.state;
  assert.equal(nextMilestone(40, 100, st).show, null);
  r = nextMilestone(80, 100, st); // 50 and 75 at once: only 75
  assert.equal(r.show, 75);
  st = r.state;
  r = nextMilestone(100, 100, st);
  assert.equal(r.show, 100);
  st = r.state;
  // more owed: back to 50%, quietly; 100% again later
  r = nextMilestone(50, 200, st);
  assert.equal(r.show, null);
  assert.deepEqual(r.state, { shown: 50, at: 200 });
  assert.equal(nextMilestone(76, 200, r.state).show, 75);
  // nothing owed: nothing
  assert.equal(nextMilestone(0, 0, { shown: 0, at: 0 }).show, null);
});

test("visibility: owner and child see all; view-only nothing; a girl's adults outside her list see prayers only, no dates", () => {
  const girl = { kind: "CHILD" as const, gender: "FEMALE" as const };
  const boy = { kind: "CHILD" as const, gender: "MALE" as const };
  const woman = { kind: "ADULT" as const, gender: "FEMALE" as const };
  assert.deepEqual(qadaAccess("self", woman, false), { edit: true, fasting: true, plan: true, dates: true, excuseAware: true, milestones: true, deleteAll: true });
  assert.equal(qadaAccess("self", { kind: "ADULT", gender: "MALE" }, false)?.excuseAware, false);
  assert.equal(qadaAccess("child", girl, false)?.milestones, true);
  assert.equal(qadaAccess("adult-view", girl, true), null);
  assert.equal(qadaAccess("adult-view", boy, true), null);
  assert.equal(qadaAccess("adult-edit", woman, true), null); // an adult never reaches another adult's
  assert.deepEqual(qadaAccess("adult-edit", girl, true), { edit: true, fasting: true, plan: true, dates: true, excuseAware: true, milestones: false, deleteAll: true });
  assert.deepEqual(qadaAccess("adult-edit", girl, false), { edit: true, fasting: false, plan: false, dates: false, excuseAware: false, milestones: false, deleteAll: false });
  assert.deepEqual(qadaAccess("adult-edit", boy, false), { edit: true, fasting: true, plan: true, dates: true, excuseAware: false, milestones: false, deleteAll: true });
});

const goal = (g: Partial<Goal>): Goal => ({ mode: "NONE", deadline: null, pace: null, from: null, baseline: null, ...g });
const ctx = { today: "2026-01-11", avg: null, excuses: null, excuseNow: false, blocked: new Set<string>() };

test("plan: today's amount from the start of today; today's own entries show as done", () => {
  const rows: DayRow[] = [
    { kind: "FAJR", action: "OWED", count: 20, day: null },
    { kind: "FAJR", action: "MADE_UP", count: 2, day: "2026-01-10" },
    { kind: "FAJR", action: "MADE_UP", count: 1, day: "2026-01-11" },
  ];
  const p = prayerPlan(rows, goal({ mode: "DEADLINE", deadline: "2026-01-19", from: "2026-01-01", baseline: 2 }), ctx);
  // 18 left at the start of today over 9 days
  assert.equal(p.today?.total, 2);
  assert.equal(p.today?.per.FAJR, 2);
  assert.equal(p.today?.done.FAJR, 1);
  // her excuse now: no amount today
  assert.equal(prayerPlan(rows, goal({ mode: "DEADLINE", deadline: "2026-01-19" }), { ...ctx, excuseNow: true }).today, null);
  // no goal: nothing
  assert.equal(prayerPlan(rows, goal({}), ctx).today, null);
  const pace = prayerPlan(rows, goal({ mode: "PACE", pace: 3 }), ctx);
  assert.equal(pace.today?.per.FAJR, 3);
  assert.equal(pace.finish, "2026-01-16");
});

test("plan: fasting per week and suggestions; none during her excuse", () => {
  const rows: DayRow[] = [{ kind: "FAST", action: "OWED", count: 8, day: null }];
  const f = fastPlan(rows, goal({ mode: "DEADLINE", deadline: addDays("2026-01-11", 27), from: "2026-01-11" }), ctx);
  assert.ok(f.perWeek !== null && Math.abs(f.perWeek - 2) < 1e-9);
  assert.ok(f.suggestions.length > 0);
  assert.equal(fastPlan(rows, goal({ mode: "DEADLINE", deadline: "2026-03-01" }), { ...ctx, excuseNow: true }).suggestions.length, 0);
});
