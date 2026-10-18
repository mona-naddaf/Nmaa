import { test } from "node:test";
import assert from "node:assert/strict";
import { parseReviewDays } from "./rules";
import { EVERY_DAY, toggleWeekday } from "@/lib/tracker/rules";

test("review days: whole numbers from 1 to 90 only", () => {
  assert.equal(parseReviewDays("14"), 14);
  assert.equal(parseReviewDays(" 1 "), 1);
  assert.equal(parseReviewDays("90"), 90);
  assert.equal(parseReviewDays("٣٠"), 30);
  for (const bad of ["", "0", "91", "-3", "7.5", "1e1", "abc", "١٠٠"]) assert.equal(parseReviewDays(bad), null, bad);
});

test("commit days: a tap switches one weekday, and the last one stays", () => {
  const SUN = 1 << 0;
  const MON = 1 << 1;
  assert.equal(toggleWeekday(EVERY_DAY, 5), EVERY_DAY & ~(1 << 5));
  assert.equal(toggleWeekday(SUN, 1), SUN | MON);
  assert.equal(toggleWeekday(SUN | MON, 0), MON);
  assert.equal(toggleWeekday(SUN, 0), null);
});
