import { test } from "node:test";
import assert from "node:assert/strict";
import { adultExcuseApplies, courseActs, courseSees, familyActs, familySees, staffSetsItemExcuse, type CourseStudent } from "./visibility";
import { actorLine, momentErrorText, momentLabel, sinceLabel } from "./texts";

const girl: CourseStudent = { id: "s1", groupId: "g1", groupGender: "GIRLS", parentVisible: false };

test("courses: her group's teachers and the supervisor see it; male staff, other groups and parents don't", () => {
  assert.equal(courseSees({ kind: "STUDENT", studentId: "s1" }, girl, true), true);
  assert.equal(courseSees({ kind: "STUDENT", studentId: "s2" }, girl, true), false);
  assert.equal(courseSees({ kind: "SUPERVISOR", gender: "FEMALE" }, girl, true), true);
  assert.equal(courseSees({ kind: "SUPERVISOR", gender: null }, girl, true), true); // no gender recorded: sees
  assert.equal(courseSees({ kind: "SUPERVISOR", gender: "MALE" }, girl, true), false);
  assert.equal(courseSees({ kind: "TEACHER", gender: "FEMALE", groupIds: ["g1", "g2"] }, girl, true), true);
  assert.equal(courseSees({ kind: "TEACHER", gender: null, groupIds: ["g1"] }, girl, true), true);
  assert.equal(courseSees({ kind: "TEACHER", gender: "FEMALE", groupIds: ["g2"] }, girl, true), false); // even if the course lets her see every student
  assert.equal(courseSees({ kind: "TEACHER", gender: "MALE", groupIds: ["g1"] }, girl, true), false);
  assert.equal(courseSees({ kind: "PARENT", studentId: "s1" }, girl, true), false);
  assert.equal(courseSees({ kind: "PARENT", studentId: "s1" }, { ...girl, parentVisible: true }, true), true);
  // off, or not a girls group (mixed included): nobody
  assert.equal(courseSees({ kind: "STUDENT", studentId: "s1" }, girl, false), false);
  assert.equal(courseSees({ kind: "SUPERVISOR", gender: "FEMALE" }, { ...girl, groupGender: "MIXED" }, true), false);
  assert.equal(courseSees({ kind: "STUDENT", studentId: "s1" }, { ...girl, groupGender: "BOYS" }, true), false);
});

test("courses: who may start/end it — she, her group's teachers, the supervisor; never a parent", () => {
  assert.equal(courseActs({ kind: "STUDENT", studentId: "s1" }, girl, true), true);
  assert.equal(courseActs({ kind: "TEACHER", gender: "FEMALE", groupIds: ["g1"] }, girl, true), true);
  assert.equal(courseActs({ kind: "SUPERVISOR", gender: null }, girl, true), true);
  assert.equal(courseActs({ kind: "PARENT", studentId: "s1" }, { ...girl, parentVisible: true }, true), false);
  assert.equal(staffSetsItemExcuse("MALE"), false);
  assert.equal(staffSetsItemExcuse(null), true);
});

test("family: she and the checked adults (default: women yes, men no); siblings never", () => {
  const child = { id: "c1", gender: "FEMALE" as const, excuseEnabled: true };
  const none = new Map<string, boolean>();
  assert.equal(familySees({ kind: "CHILD", id: "c1" }, child, none), true);
  assert.equal(familySees({ kind: "CHILD", id: "c2" }, child, none), false);
  assert.equal(familySees({ kind: "ADULT", id: "mum", gender: "FEMALE" }, child, none), true);
  assert.equal(familySees({ kind: "ADULT", id: "dad", gender: "MALE" }, child, none), false);
  const set = new Map([["dad", true], ["aunt", false]]);
  assert.equal(familySees({ kind: "ADULT", id: "dad", gender: "MALE" }, child, set), true);
  assert.equal(familySees({ kind: "ADULT", id: "aunt", gender: "FEMALE" }, child, set), false);
  assert.equal(familyActs({ kind: "ADULT", id: "dad", gender: "MALE" }, child, none), false);
  // off, or a boy: nobody
  assert.equal(familySees({ kind: "CHILD", id: "c1" }, { ...child, excuseEnabled: false }, none), false);
  assert.equal(familySees({ kind: "ADULT", id: "mum", gender: "FEMALE" }, { ...child, gender: "MALE" }, none), false);
});

test("an adult's own excuse: women who turned it on", () => {
  assert.equal(adultExcuseApplies({ kind: "ADULT", gender: "FEMALE", excuseEnabled: true }), true);
  assert.equal(adultExcuseApplies({ kind: "ADULT", gender: "FEMALE", excuseEnabled: false }), false);
  assert.equal(adultExcuseApplies({ kind: "ADULT", gender: "MALE", excuseEnabled: true }), false);
  assert.equal(adultExcuseApplies({ kind: "CHILD", gender: "FEMALE", excuseEnabled: true }), false);
});

test("approved wording", () => {
  const today = "2026-10-27";
  assert.equal(sinceLabel("2026-10-27", today), "معذورة اليوم");
  assert.equal(sinceLabel("2026-10-26", today), "معذورة منذ أمس");
  assert.equal(sinceLabel("2026-10-25", today), "معذورة منذ يومين");
  assert.equal(sinceLabel("2026-10-24", today), "معذورة منذ 3 أيام");
  assert.equal(sinceLabel("2026-10-17", today), "معذورة منذ 10 أيام");
  assert.equal(sinceLabel("2026-10-16", today), "معذورة منذ 11 يومًا");
  assert.equal(sinceLabel("2026-10-24", today, "سارة"), "سارة معذورة منذ 3 أيام");
  assert.equal(momentLabel({ day: "2026-10-26", min: 21 * 60 + 40 }, today), "أمس 9:40 م");
  assert.equal(actorLine("start", { kind: "PERSON", name: "سارة", gender: "FEMALE" }, { day: today, min: 375 }, today), "بدأته سارة · اليوم 6:15 ص");
  assert.equal(actorLine("start", { kind: "PERSON", name: "أحمد", gender: "MALE" }, { day: today, min: 375 }, today), "بدأه أحمد · اليوم 6:15 ص");
  assert.equal(actorLine("end", { kind: "TEACHER", name: "نورة" }, { day: today, min: 800 }, today), "أنهته المعلمة نورة · اليوم 1:20 م");
  assert.equal(actorLine("start", { kind: "STUDENT" }, { day: today, min: 800 }, today), "بدأته الطالبة · اليوم 1:20 م");
  assert.equal(actorLine("start", { kind: "SUPERVISOR", gender: null }, { day: today, min: 800 }, today), "بدأته المشرفة · اليوم 1:20 م");
  assert.equal(actorLine("end", "AUTO", { day: today, min: 0 }, today), "انتهى تلقائيًا بعد 15 يومًا");
  assert.equal(momentErrorText("NO_TIME", "FEMALE", null, today), "اختاري الوقت أولًا");
  assert.equal(momentErrorText("FUTURE", null, null, today), "هذا الوقت لم يأتِ بعد");
  assert.equal(momentErrorText("OVERLAP", "FEMALE", { day: "2026-10-26", min: 1300 }, today), "انتهى العذر السابق أمس 9:40 م، فاختاري وقتًا بعده");
  assert.equal(momentErrorText("BEFORE_START", "MALE", { day: "2026-10-26", min: 1300 }, today), "بدأ العذر أمس 9:40 م، فاختر وقتًا بعده");
});
