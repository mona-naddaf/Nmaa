import { test } from "node:test";
import assert from "node:assert/strict";
import { addReport, copyReport, itemsCount, normalizeTitle, planCopy, reportOf, type CopySource, type CopyTarget } from "./tracker-copy";

const clock = { weekdays: 127, startMin: 420, durationMin: 15, anchor: null, anchorOffsetMin: null };
const afterFajr = { weekdays: 127, startMin: null, durationMin: 10, anchor: "FAJR" as const, anchorOffsetMin: 10 };
const item = (title: string, slots: CopySource["slots"] = []): CopySource => ({ title, value: 2, days: 127, slots });
const target = (o: Partial<CopyTarget> = {}): CopyTarget => ({ id: "laila", name: "ليلى", gender: "FEMALE", titles: [], count: 0, agenda: false, hasPlace: false, ...o });

test("planCopy: everything into an empty tracker, in order", () => {
  const [p] = planCopy([item("أذكار الصباح"), item("ورد المراجعة")], [target()], 30);
  assert.deepEqual(p.create.map((c) => c.item.title), ["أذكار الصباح", "ورد المراجعة"]);
  assert.equal(p.duplicates + p.full + p.untimed, 0);
});

test("planCopy: same title (spaces tidied) is skipped, also twice in the source", () => {
  const [p] = planCopy([item("  أذكار   الصباح "), item("ورد"), item("ورد")], [target({ titles: ["أذكار الصباح"], count: 1 })], 30);
  assert.deepEqual(p.create.map((c) => c.item.title), ["ورد"]);
  assert.equal(p.duplicates, 2);
  assert.equal(normalizeTitle("  a \n b "), "a b");
});

test("planCopy: stops at the maximum; duplicates don't use up room", () => {
  const [p] = planCopy([item("موجود"), item("أ"), item("ب"), item("ج")], [target({ titles: ["موجود"], count: 29 })], 30);
  assert.deepEqual(p.create.map((c) => c.item.title), ["أ"]);
  assert.equal(p.duplicates, 1);
  assert.equal(p.full, 2);
  const [none] = planCopy([item("أ")], [target({ count: 30 })], 30);
  assert.equal(none.create.length, 0);
  assert.equal(none.full, 1);
});

test("planCopy: times — only with her agenda on; a prayer time needs a city", () => {
  const src = [item("بوقت", [clock]), item("بعد الفجر", [afterFajr]), item("بلا وقت")];
  const [off] = planCopy(src, [target({ agenda: false })], 30);
  assert.deepEqual(off.create.map((c) => c.withTime), [false, false, false]);
  assert.equal(off.untimed, 0);
  const [noCity] = planCopy(src, [target({ agenda: true, hasPlace: false })], 30);
  assert.deepEqual(noCity.create.map((c) => c.withTime), [true, false, false]);
  assert.equal(noCity.untimed, 1);
  const [city] = planCopy(src, [target({ agenda: true, hasPlace: true })], 30);
  assert.deepEqual(city.create.map((c) => c.withTime), [true, true, false]);
  assert.equal(city.untimed, 0);
});

test("planCopy: each child on her own", () => {
  const plans = planCopy([item("أ"), item("ب")], [target({ id: "a", titles: ["أ"], count: 1 }), target({ id: "b", count: 29 })], 30);
  assert.deepEqual(plans.map((p) => [p.id, p.create.length, p.duplicates, p.full]), [["a", 1, 1, 0], ["b", 1, 0, 1]]);
});

test("itemsCount: Arabic number agreement", () => {
  assert.deepEqual([1, 2, 3, 10, 11, 30, 100, 102, 103].map(itemsCount), ["بند واحد", "بندان", "3 بنود", "10 بنود", "11 بندًا", "30 بندًا", "100 بند", "102 بند", "103 بنود"]);
});

test("the reports: gendered, one reason each", () => {
  const plans = planCopy(
    [item("أ", [afterFajr])],
    [target({ id: "l" }), target({ id: "o", name: "عمر", gender: "MALE", titles: ["أ"] }), target({ id: "s", name: "سارة", count: 30 }), target({ id: "z", name: "زيد", gender: "MALE", agenda: true })],
    30,
  );
  const lines = reportOf(plans, { l: 1, z: 1 });
  assert.deepEqual(addReport(lines, 30), [
    "أُضيف البند إلى: ليلى، زيد ✓",
    "لم يُضَف إلى عمر: موجود في جدوله",
    "لم يُضَف إلى سارة: بلغ جدولها 30 بندًا",
    "أُضيف إلى زيد بلا وقت: لم تُحدَّد مدينة العائلة لمواقيت الصلاة",
  ]);
  assert.deepEqual(copyReport([{ name: "ليلى", gender: "FEMALE", added: 5, duplicates: 2, full: 1, untimed: 0 }, { name: "عمر", gender: "MALE", added: 0, duplicates: 3, full: 0, untimed: 0 }], 30), [
    "ليلى — نُسخ: 5 بنود · تُرك ما يوجد في جدولها بالاسم نفسه: بندان · تُرك ما زاد على 30 بندًا: بند واحد",
    "عمر — لم يُنسخ شيء · تُرك ما يوجد في جدوله بالاسم نفسه: 3 بنود",
  ]);
});
