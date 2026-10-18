import { test } from "node:test";
import assert from "node:assert/strict";
import { planTemplateApply, skippedItemsLine } from "./template-rules";

const items = (...titles: string[]) => titles.map((title) => ({ title }));

test("using a template: titles she already has are left out (spaces tidied)", () => {
  const r = planTemplateApply(items("ورد المراجعة", "أذكار الصباح", "قيام الليل"), ["  ورد   المراجعة "], 30);
  assert.deepEqual(r, { create: items("أذكار الصباح", "قيام الليل"), skipped: 1 });
});

test("a title repeated inside the template is added once", () => {
  const r = planTemplateApply(items("أذكار الصباح", "أذكار الصباح"), [], 30);
  assert.deepEqual(r, { create: items("أذكار الصباح"), skipped: 1 });
});

test("room is counted on what would really be added", () => {
  // 3 in the template, 2 already hers, room for 1: fits
  assert.deepEqual(planTemplateApply(items("أ", "ب", "ج"), ["أ", "ب"], 1), { create: items("ج"), skipped: 2 });
  assert.deepEqual(planTemplateApply(items("أ", "ب", "ج"), ["أ"], 1), { error: "no-room", adding: 2 });
  // everything already there: nothing to add, never «no room»
  assert.deepEqual(planTemplateApply(items("أ"), ["أ"], 0), { create: [], skipped: 1 });
});

test("the left-out line agrees with its number", () => {
  assert.equal(skippedItemsLine(1, "جدولكِ"), "تُرك بند واحد موجود في جدولكِ بالاسم نفسه.");
  assert.equal(skippedItemsLine(2, "جدولكِ"), "تُرك بندان موجودان في جدولكِ بالاسم نفسه.");
  assert.equal(skippedItemsLine(3, "جدولك"), "تُركت 3 بنود موجودة في جدولك بالاسم نفسه.");
  assert.equal(skippedItemsLine(11, "جدولك"), "تُرك 11 بندًا موجودًا في جدولك بالاسم نفسه.");
});
