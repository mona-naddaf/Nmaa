import { test } from "node:test";
import assert from "node:assert/strict";
import { withPendingRange } from "./prior-range";

// a reverse Juz' Amma start: الناس, الفلق, الإخلاص, المسد, النصر
const plan = [114, 113, 112, 111, 110];

test("a pending range joins the completed surahs, in plan order and without repeats", () => {
  const prior = { completedSurahs: [112], partial: null };
  assert.deepEqual(withPendingRange(plan, prior, 114, 112), { completedSurahs: [112, 114, 113], partial: null });
  // endpoints in either order
  assert.deepEqual(withPendingRange(plan, { completedSurahs: [], partial: null }, 111, 113).completedSurahs, [113, 112, 111]);
});

test("a partial surah inside the range is dropped; outside it stays", () => {
  const partial = { surahNumber: 113, fromAyah: 1, toAyah: 3 };
  assert.equal(withPendingRange(plan, { completedSurahs: [], partial }, 114, 112).partial, null);
  assert.deepEqual(withPendingRange(plan, { completedSurahs: [], partial }, 111, 110).partial, partial);
});

test("no range, half a range, or an end outside the plan: unchanged", () => {
  const prior = { completedSurahs: [114], partial: null };
  assert.equal(withPendingRange(plan, prior, null, null), prior);
  assert.equal(withPendingRange(plan, prior, 113, null), prior);
  assert.equal(withPendingRange(plan, prior, 2, 113), prior);
});
