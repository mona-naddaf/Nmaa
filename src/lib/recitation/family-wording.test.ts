import { test } from "node:test";
import assert from "node:assert/strict";
import { classifyRecitation, deriveReach } from "./logic";
import { mistakeTypeLabel } from "@/lib/students/mistake-types";

// «العائلة»: an adult reciting with a child reads about the child by name,
// gendered by the child — never the course's «الطالب / الطالبة».

const salim = { child: { name: "سليم", gender: "MALE" as const } };
const maryam = { child: { name: "مريم", gender: "FEMALE" as const } };

test("mistake types: the family wording, by the child's gender", () => {
  assert.equal(mistakeTypeLabel("FORGOT_PROMPTED", salim), "احتاج تذكيرًا");
  assert.equal(mistakeTypeLabel("FORGOT_PROMPTED", maryam), "احتاجت تذكيرًا");
  assert.equal(mistakeTypeLabel("HESITATED_SELF_CORRECTED", salim), "تعثّر وصحّح بنفسه");
  assert.equal(mistakeTypeLabel("HESITATED_SELF_CORRECTED", maryam), "تعثّرت وصحّحت بنفسها");
  assert.equal(mistakeTypeLabel("PRONUNCIATION", maryam), "خطأ تشكيل");
  // unchanged for courses and for the learner herself
  assert.equal(mistakeTypeLabel("FORGOT_PROMPTED", "BOYS"), "تم ردّه");
  assert.equal(mistakeTypeLabel("FORGOT_PROMPTED", { self: "FEMALE" }), "نسيتُها واحتجتُ تذكيرًا");
});

// juz «عمّ» backwards: الناس, الفلق, الإخلاص …
const PLAN = [114, 113, 112, 111];

test("gap messages: the child's plan, by name", () => {
  const reach = deriveReach(PLAN, []);
  for (const [subject, name, verb] of [[salim, "سليم", "وصل"], [maryam, "مريم", "وصلت"]] as const) {
    const outside = classifyRecitation(PLAN, reach, 2, 1, subject);
    assert.ok(outside.warningMessage?.includes(`خطة ${name}`), String(outside.warningMessage));
    assert.ok(!outside.warningMessage?.includes("الطالب"), String(outside.warningMessage));
    // starting الفلق before finishing الناس: «… وصل سليم / وصلت مريم إلى الآية …»
    const reachHalf = deriveReach(PLAN, [{ surahNumber: 114, fromAyah: 1, toAyah: 3, type: "NEW", situation: "CONTINUE", reason: null }]);
    const gap = classifyRecitation(PLAN, reachHalf, 113, 1, subject);
    assert.ok(gap.warningMessage?.includes(`${verb} ${name}`), String(gap.warningMessage));
  }
});
