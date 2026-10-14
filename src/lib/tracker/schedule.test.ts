import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ALL_DAYS,
  copyToDays,
  effectiveTiming,
  resolveTiming,
  rowFor,
  scheduleLabel,
  scheduleModel,
  scheduleRows,
  timingLabel,
  timingLabelOn,
  timingRow,
  validateSchedule,
  validateTiming,
  type SlotRow,
  type Timing,
} from "./schedule";
import { prayerMinutes } from "@/lib/prayer/times";

const nb = (s: string) => s.replace(/ (ص|م)/g, " $1");
const SUN = 1 << 0;
const TUE = 1 << 2;
const clock = (startMin: number, durationMin: number | null = null): Timing => ({ kind: "CLOCK", startMin, durationMin });
const after = (prayer: "FAJR" | "MAGHRIB" | "ISHA" | "ASR", offsetMin = 0, durationMin: number | null = null): Timing => ({ kind: "PRAYER", prayer, offsetMin, durationMin });

test("weekday overrides: a day-specific row beats the every-day row; her rows beat staff's", () => {
  const staff: SlotRow[] = [timingRow(ALL_DAYS, clock(20 * 60, 30)), timingRow(SUN | TUE, after("ASR"))];
  assert.deepEqual(rowFor(staff, 0)?.anchor, "ASR"); // Sunday: halaqa day
  assert.equal(rowFor(staff, 1)?.startMin, 20 * 60); // Monday: every day
  assert.equal(rowFor([], 1), undefined);
  // her own: only Mondays at 6:00; elsewhere staff's
  const own: SlotRow[] = [timingRow(1 << 1, clock(360))];
  assert.deepEqual(effectiveTiming(own, staff, 1), { timing: clock(360), own: true });
  assert.deepEqual(effectiveTiming(own, staff, 2), { timing: after("ASR"), own: false });
  // her every-day «بلا وقت» replaces staff's every day
  assert.deepEqual(effectiveTiming([timingRow(ALL_DAYS, null)], staff, 0), { timing: null, own: true });
});

test("anchors resolve from the day's prayer times; labels show both", () => {
  const riyadh = { key: "riyadh", name: "الرياض", lat: 24.7136, lng: 46.6753, method: "UMM_AL_QURA" as const, asr: "SHAFI" as const };
  const p = prayerMinutes(riyadh, "2026-10-14", "Asia/Riyadh"); // Fajr 4:33, Maghrib 17:28
  assert.deepEqual(resolveTiming(after("FAJR"), p), { startMin: 4 * 60 + 33, durationMin: null });
  assert.deepEqual(resolveTiming(after("MAGHRIB", -15, 15), p), { startMin: 17 * 60 + 13, durationMin: 15 });
  assert.equal(resolveTiming(after("FAJR"), null), null); // no place: can't be placed
  assert.deepEqual(resolveTiming(clock(450, 30), null), { startMin: 450, durationMin: 30 });
  assert.equal(timingLabel(after("FAJR")), "بعد الفجر");
  assert.equal(timingLabel(after("MAGHRIB", -15)), "قبل المغرب بـ 15 دقيقة");
  assert.equal(timingLabel(after("ASR", 5)), "بعد العصر بـ 5 دقائق");
  assert.equal(timingLabel(after("ISHA", 2)), "بعد العشاء بدقيقتين");
  assert.equal(timingLabel(null), "بلا وقت");
  assert.equal(timingLabelOn(after("FAJR"), resolveTiming(after("FAJR"), p)), nb("بعد الفجر · 4:33 ص"));
  assert.equal(timingLabelOn(after("MAGHRIB", -15, 15), resolveTiming(after("MAGHRIB", -15, 15), p)), nb("قبل المغرب بـ 15 دقيقة · 5:13 م – 5:28 م"));
  // items move with the seasons: Fajr in June is an hour earlier than in October
  const june = prayerMinutes(riyadh, "2026-06-21", "Asia/Riyadh");
  assert.ok(resolveTiming(after("FAJR"), june)!.startMin < resolveTiming(after("FAJR"), p)!.startMin - 50);
});

test("anchors near midnight: a late summer Isha runs past midnight; an early-Fajr «before» never goes below midnight", () => {
  const stockholm = { key: null, name: "ستوكهولم", lat: 59.3293, lng: 18.0686, method: "MWL" as const, asr: "SHAFI" as const };
  const p = prayerMinutes(stockholm, "2026-06-21", "Europe/Stockholm");
  const isha = resolveTiming(after("ISHA", 30, 60), p)!;
  assert.ok(isha.startMin > 22 * 60); // late in the evening (or past midnight: > 1440 belongs to the day it starts)
  const beforeFajr = resolveTiming(after("FAJR", -180), p)!;
  assert.equal(beforeFajr.startMin, Math.max(0, p.FAJR - 180));
  assert.ok(beforeFajr.startMin >= 0);
});

test("validation: timings, anchors only with a place, disjoint weekday rows", () => {
  assert.deepEqual(validateTiming({ kind: "CLOCK", startMin: 300, durationMin: 30 }, false), clock(300, 30));
  assert.deepEqual(validateTiming({ kind: "PRAYER", prayer: "FAJR", offsetMin: -15, durationMin: null }, true), after("FAJR", -15));
  assert.equal(validateTiming({ kind: "PRAYER", prayer: "FAJR", offsetMin: 0 }, false), "ERR"); // no place
  assert.equal(validateTiming({ kind: "PRAYER", prayer: "NOON", offsetMin: 0 }, true), "ERR");
  assert.equal(validateTiming({ kind: "PRAYER", prayer: "FAJR", offsetMin: 181 }, true), "ERR");
  assert.equal(validateTiming({ kind: "CLOCK", startMin: 1440 }, true), "ERR");
  assert.equal(validateTiming({ kind: "CLOCK", startMin: 60, durationMin: 2 }, true), "ERR");
  assert.equal(validateTiming(null, false), null);
  assert.ok(validateSchedule([{ weekdays: 127, timing: { kind: "CLOCK", startMin: 60 } }, { weekdays: SUN | TUE, timing: null }], false));
  assert.equal(validateSchedule([{ weekdays: 127, timing: null }, { weekdays: 127, timing: null }], false), null); // two every-day rows
  assert.equal(validateSchedule([{ weekdays: SUN | TUE, timing: null }, { weekdays: TUE, timing: null }], false), null); // overlapping days
  assert.equal(validateSchedule([{ weekdays: 0, timing: null }], false), null);
  assert.equal(validateSchedule("x", false), null);
});

test("the editor's model: rows ↔ model, «نسخ إلى أيام أخرى», shared rows for equal days", () => {
  const base = clock(20 * 60, 30);
  let days: Partial<Record<number, Timing>> = { 0: after("ASR") };
  days = copyToDays(days, after("ASR"), [2, 4]); // Sunday's timing to Tuesday and Thursday
  days = copyToDays(days, base, [5]); // Friday as every day: no row needed
  const rows = scheduleRows(base, days);
  assert.deepEqual(rows, [
    { weekdays: ALL_DAYS, timing: base },
    { weekdays: SUN | TUE | (1 << 4), timing: after("ASR") },
  ]);
  const stored = validateSchedule(rows, true)!;
  const model = scheduleModel(stored);
  assert.deepEqual(model.base, base);
  assert.deepEqual(model.days, { 0: after("ASR"), 2: after("ASR"), 4: after("ASR") });
  assert.equal(scheduleLabel(stored), nb("8:00 م – 8:30 م · تختلف بعض الأيام"));
  assert.equal(scheduleLabel([]), "بلا وقت");
});
