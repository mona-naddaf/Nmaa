import { test } from "node:test";
import assert from "node:assert/strict";
import { countdownLabel, pastDayLabel } from "./hijri";

test("pastDayLabel: yesterday, a few days ago, then the date (the year only when it differs)", () => {
  const today = "2026-10-17";
  assert.equal(pastDayLabel("2026-10-16", today), "أمس");
  assert.equal(pastDayLabel("2026-10-15", today), "قبل يومين");
  assert.equal(pastDayLabel("2026-10-14", today), "قبل 3 أيام");
  assert.equal(pastDayLabel("2026-10-07", today), "قبل 10 أيام");
  assert.equal(pastDayLabel("2026-10-06", today), "6 أكتوبر");
  assert.equal(pastDayLabel("2026-01-01", today), "1 يناير");
  assert.equal(pastDayLabel("2025-12-31", "2026-01-02"), "قبل يومين");
  assert.equal(pastDayLabel("2025-12-01", "2026-01-02"), "1 ديسمبر 2025");
});

test("countdownLabel: today, tomorrow, the dual, plural and accusative", () => {
  assert.deepEqual([0, 1, 2, 3, 10, 11, 30].map(countdownLabel), ["اليوم", "غدًا", "بعد يومين", "بعد 3 أيام", "بعد 10 أيام", "بعد 11 يومًا", "بعد 30 يومًا"]);
});
