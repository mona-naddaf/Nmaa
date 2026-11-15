import { test } from "node:test";
import assert from "node:assert/strict";
import { addDays, daysBetween, fromHijri } from "@/lib/calendar/hijri";
import { monthlyFromCycle, predictCycle, predictedDays, type ExcuseRecord } from "./cycle";
import { excusedRamadanDays, nextRamadan, ramadanOf, ramadanToOffer } from "./ramadan";
import { ramadanReminder, REMINDER_MARGIN_DAYS } from "./reminder";
import { itemOfRef, linkableKinds, linkShown, linkToSave, tickEffect, trackerRef } from "./link";
import { blockedFastDays } from "./fasting-days";
import { qadaAccess } from "./visibility";

const girl = { kind: "CHILD" as const, gender: "FEMALE" as const };
const self = qadaAccess("child", girl, false);
const inList = qadaAccess("adult-edit", girl, true);
const outside = qadaAccess("adult-edit", girl, false);

// ---------- linking ----------

test("link: one entry per item and day; unticking removes it; nothing while «القضاء» is off", () => {
  assert.equal(trackerRef("item1", "2026-11-16"), "item1:2026-11-16");
  assert.equal(itemOfRef("item1:2026-11-16"), "item1");
  assert.equal(itemOfRef(null), null);
  assert.equal(tickEffect(true, "FAJR", true), "add");
  assert.equal(tickEffect(false, "FAJR", true), "remove");
  assert.equal(tickEffect(true, null, true), "none");
  assert.equal(tickEffect(true, "FAJR", false), "none");
  // a tick made while it was on is still taken back
  assert.equal(tickEffect(false, "FAJR", false), "remove");
});

test("link: an adult outside a girl's list never sees, sets or clears a link to fasting", () => {
  assert.deepEqual(linkableKinds(outside), ["FAJR", "DHUHR", "ASR", "MAGHRIB", "ISHA"]);
  assert.equal(linkableKinds(inList).includes("FAST"), true);
  assert.deepEqual(linkableKinds(null), []);
  assert.equal(linkShown("FAST", outside), false);
  assert.equal(linkShown("FAJR", outside), true);
  assert.equal(linkShown("FAST", self), true);
  // their form never had it: kept as it was, whatever came
  assert.equal(linkToSave("FAST", null, outside), "FAST");
  assert.equal(linkToSave("FAST", "FAJR", outside), "FAST");
  // and they can't set it
  assert.equal(linkToSave(null, "FAST", outside), null);
  assert.equal(linkToSave("FAJR", "ISHA", outside), "ISHA");
  // no field (qada off, view-only): unchanged; «لا»: cleared
  assert.equal(linkToSave("ASR", "FAJR", null), "ASR");
  assert.equal(linkToSave("ASR", undefined, self), "ASR");
  assert.equal(linkToSave("ASR", null, self), null);
  assert.equal(linkToSave(null, "FAST", self), "FAST");
  assert.equal(linkToSave(null, "SUNRISE", self), null);
});

// ---------- Ramadan ----------

const R = ramadanOf(1448)!;
const at = (d: number, min: number) => ({ day: addDays(R.first, d), min });

test("Ramadan: a day counts when the excuse overlaps its fasting hours", () => {
  assert.equal(R.first, fromHijri(1448, 9, 1));
  const hours = () => ({ from: 4 * 60 + 30, to: 18 * 60 });
  // from day 3 at 10:00 to day 9 at 20:00 → days 3..9 = 7
  assert.equal(excusedRamadanDays(R, [{ start: at(3, 600), end: at(9, 1200) }], hours), 7);
  // ended before Fajr on day 9 → day 9 is hers to fast: 6
  assert.equal(excusedRamadanDays(R, [{ start: at(3, 600), end: at(9, 200) }], hours), 6);
  // began after Maghrib on day 3 → day 3 doesn't count
  assert.equal(excusedRamadanDays(R, [{ start: at(3, 1150), end: at(9, 1200) }], hours), 6);
  // two excuses touching the same day count it once
  assert.equal(excusedRamadanDays(R, [{ start: at(0, 600), end: at(1, 600) }, { start: at(1, 700), end: at(1, 800) }], hours), 2);
  // before Ramadan, running into it
  assert.equal(excusedRamadanDays(R, [{ start: { day: addDays(R.first, -3), min: 0 }, end: at(1, 600) }], hours), 2);
});

test("Ramadan without a city: any overlap with the day itself", () => {
  const none = () => null;
  // ended at 01:00 on day 9: day 9 counts here
  assert.equal(excusedRamadanDays(R, [{ start: at(3, 600), end: at(9, 60) }], none), 7);
});

test("Ramadan: offered from the Eid until the next Ramadan begins", () => {
  assert.equal(ramadanToOffer(addDays(R.first, 5)), null);
  assert.equal(ramadanToOffer(R.eid)?.year, 1448);
  assert.equal(ramadanToOffer(addDays(R.eid, 200))?.year, 1448);
  const next = ramadanOf(1449)!;
  assert.equal(ramadanToOffer(addDays(next.first, -1))?.year, 1448);
  assert.equal(ramadanToOffer(next.first), null);
  // a moon-sighting shift moves the Eid
  assert.equal(ramadanToOffer(R.eid, [{ occasion: "EID_FITR", hijriYear: 1448, offsetDays: 1 }]), null);
  assert.equal(nextRamadan(addDays(R.first, -10))?.first, R.first);
  assert.equal(nextRamadan(addDays(R.first, 3)), null);
  assert.equal(nextRamadan(R.eid)?.year, 1449);
});

// ---------- the reminder ----------

test("reminder: shows once the days she can fast are no more than what she owes + 7", () => {
  const ramadan = R.first;
  const blocked = blockedFastDays(addDays(ramadan, -200), addDays(ramadan, 40));
  const base = { ramadan, remaining: 6, blocked, prediction: null, avg: null };
  // the last day of شعبان is left out: from 14 days before, 13 days are open
  assert.equal(ramadanReminder({ ...base, today: addDays(ramadan, -14) })?.fastable, 13);
  assert.equal(ramadanReminder({ ...base, today: addDays(ramadan, -15) }), null);
  assert.equal(REMINDER_MARGIN_DAYS, 7);
  // her average: 7 a month takes ~5 of 20 open days → shows from 19 days before (14 + 5)
  const w = { ...base, avg: 7 };
  assert.ok(ramadanReminder({ ...w, today: addDays(ramadan, -18) }));
  assert.equal(ramadanReminder({ ...w, today: addDays(ramadan, -22) }), null);
  // nothing owed, or Ramadan on: nothing
  assert.equal(ramadanReminder({ ...base, remaining: 0, today: addDays(ramadan, -3) }), null);
  assert.equal(ramadanReminder({ ...base, today: ramadan }), null);
  assert.equal(ramadanReminder({ ...base, today: addDays(ramadan, -3) })?.daysLeft, 3);
});

test("reminder: the predicted windows take their own days", () => {
  const ramadan = R.first;
  const blocked = blockedFastDays(addDays(ramadan, -200), addDays(ramadan, 40));
  const today = addDays(ramadan, -20);
  // a 7-day window starting 10 days from today
  const prediction = { cycle: 28, duration: 7, lastStart: addDays(today, 10 - 28) };
  const r = ramadanReminder({ today, ramadan, remaining: 6, blocked, prediction, avg: 7 });
  assert.equal(r?.fastable, 19 - 7);
});

// ---------- prediction ----------

const rec = (start: string, len: number, auto = false): ExcuseRecord => ({ start, end: addDays(start, len - 1), auto });

test("prediction: needs 4 records and 3 complete cycles; medians of the last 6", () => {
  const s = "2026-01-01";
  const three = [rec(s, 7), rec(addDays(s, 28), 6), rec(addDays(s, 57), 7)];
  assert.equal(predictCycle(three), null);
  const four = [...three, rec(addDays(s, 85), 7)];
  assert.deepEqual(predictCycle(four), { cycle: 28, duration: 7, lastStart: addDays(s, 85) });
  // the last one still open is fine; one of the 3 before it open is not
  assert.ok(predictCycle([...three, { start: addDays(s, 85), end: null, auto: false }]));
  assert.equal(predictCycle([rec(s, 7), { start: addDays(s, 28), end: null, auto: false }, rec(addDays(s, 57), 7), rec(addDays(s, 85), 7)]), null);
  // a 120-day hole in her records isn't a cycle
  const holes = [rec(s, 7), rec(addDays(s, 120), 7), rec(addDays(s, 148), 7), rec(addDays(s, 177), 6)];
  assert.equal(predictCycle(holes), null);
  // an excuse that ended by itself has no duration
  const autos = [rec(s, 15, true), rec(addDays(s, 28), 7), rec(addDays(s, 57), 6), rec(addDays(s, 85), 7)];
  assert.deepEqual(predictCycle(autos), { cycle: 28, duration: 7, lastStart: addDays(s, 85) });
  // one long month doesn't move the median
  const odd = [rec(s, 7), rec(addDays(s, 28), 12), rec(addDays(s, 56), 7), rec(addDays(s, 84), 7)];
  assert.equal(predictCycle(odd)?.duration, 7);
});

test("prediction: per-month figure and the next windows", () => {
  const p = { cycle: 28, duration: 7, lastStart: "2026-01-01" };
  assert.equal(monthlyFromCycle(p), 7.5);
  const days = [...predictedDays(p, "2026-01-01", "2026-02-10")];
  // the next window after the last start: 29 Jan – 4 Feb
  assert.equal(days.length, 7);
  assert.equal(days[0], "2026-01-29");
  assert.equal(daysBetween(days[0], days[6]), 6);
});
