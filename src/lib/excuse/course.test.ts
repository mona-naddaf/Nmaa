import { test } from "node:test";
import assert from "node:assert/strict";
import { courseExcuseDesc, courseGoalPausedText, lastExcuseLine } from "./texts";
import { attendanceSeen } from "./attendance";
import { excuseLens, quietLens, viewerLens } from "./lens";
import { courseActs, courseSees, type CourseStudent, type CourseViewer } from "./visibility";
import { keyOf } from "./rules";

// G3: addressed by the supervisor's recorded gender; feminine when none is recorded.

test("G3: a man gets the masculine wording; a woman or no gender recorded the feminine", () => {
  assert.ok(courseExcuseDesc("MALE").includes("والمشرف فقط") && courseExcuseDesc("MALE").includes("إلا إن فعّلتَ"));
  for (const g of ["FEMALE", null] as const) {
    assert.ok(courseExcuseDesc(g).includes("والمشرفة فقط") && courseExcuseDesc(g).includes("إلا إن فعّلتِ"));
  }
});

const her: CourseStudent = { id: "s1", groupId: "g1", groupGender: "GIRLS", parentVisible: false };
const supervisor: CourseViewer = { kind: "SUPERVISOR", gender: "FEMALE" };
const noGender: CourseViewer = { kind: "SUPERVISOR", gender: null };
const man: CourseViewer = { kind: "SUPERVISOR", gender: "MALE" };
const herTeacher: CourseViewer = { kind: "TEACHER", gender: "FEMALE", groupIds: ["g1"] };
const otherTeacher: CourseViewer = { kind: "TEACHER", gender: "FEMALE", groupIds: ["g2"] };
const maleTeacher: CourseViewer = { kind: "TEACHER", gender: "MALE", groupIds: ["g1"] };
const parent: CourseViewer = { kind: "PARENT", studentId: "s1" };

test("who sees «معذورة»: her supervisor and her group's teachers, never men, other groups or a parent by default", () => {
  for (const v of [supervisor, noGender, herTeacher]) assert.equal(courseSees(v, her, true), true);
  for (const v of [man, otherTeacher, maleTeacher, parent]) assert.equal(courseSees(v, her, true), false);
});

test("the parent switch shows it to her parent, who still can't act on it", () => {
  const shown = { ...her, parentVisible: true };
  assert.equal(courseSees(parent, shown, true), true);
  assert.equal(courseActs(parent, shown, true), false);
});

test("a boys or mixed group never has it, and nothing is acted on with the switch off", () => {
  for (const groupGender of ["BOYS", "MIXED"] as const) assert.equal(courseSees(supervisor, { ...her, groupGender }, true), false);
  assert.equal(courseActs(supervisor, her, false), false);
});

test("G6: who may not see «معذورة» gets that day with no status; everything else is untouched", () => {
  assert.equal(attendanceSeen("EXCUSED", false), "PENDING");
  assert.equal(attendanceSeen("EXCUSED", true), "EXCUSED");
  for (const s of ["IN", "OUT", "PENDING"] as const) assert.equal(attendanceSeen(s, false), s);
});

test("a quiet viewer gets no alternative and no excuse day, only what isn't due", () => {
  const key = keyOf("2026-11-02", "i1");
  const lens = viewerLens([{ id: "i1", excuseMode: "ALT", excuseAltTitle: "100 تسبيحة" }], undefined, [key], { day: "2026-11-02", min: 600 })!;
  assert.equal(lens.quiet, true);
  assert.equal(lens.skipped("i1", "2026-11-02"), true);
  assert.deepEqual(lens.view("i1", "2026-11-02"), { state: "ORIGINAL", alt: null });
  assert.equal(lens.isExcuseDay("2026-11-02"), false);
  assert.equal(viewerLens([], undefined, undefined, { day: "2026-11-02", min: 0 }), undefined);
  assert.equal(quietLens([]).quiet, true);
});

test("who sees it gets the real lens", () => {
  const excuses = [{ start: { day: "2026-11-02", min: 0 }, end: null, keepOriginal: [], keepExcused: [] }];
  const items = [{ id: "i1", excuseMode: "ALT" as const, excuseAltTitle: "100 تسبيحة" }];
  const now = { day: "2026-11-02", min: 600 };
  assert.deepEqual(viewerLens(items, excuses, undefined, now)!.view("i1", now.day), excuseLens(items, excuses, now).view("i1", now.day));
  assert.equal(viewerLens(items, excuses, undefined, now)!.view("i1", now.day).alt, "100 تسبيحة");
});

test("G9: her last excuse's line", () => {
  assert.equal(lastExcuseLine("2026-10-10", "2026-10-16", { kind: "STUDENT" }), "آخر عذر: 10 – 16 أكتوبر · أنهته الطالبة");
  assert.equal(lastExcuseLine("2026-09-28", "2026-10-03", { kind: "TEACHER", name: "نورة" }), "آخر عذر: 28 سبتمبر – 3 أكتوبر · أنهته المعلمة نورة");
  assert.equal(lastExcuseLine("2026-10-10", "2026-10-10", { kind: "SUPERVISOR", gender: null }), "آخر عذر: 10 أكتوبر · أنهته المشرفة");
  assert.equal(lastExcuseLine("2026-10-10", "2026-10-25", "AUTO"), "آخر عذر: 10 – 25 أكتوبر · انتهى تلقائيًا");
  assert.equal(lastExcuseLine("2026-10-10", "2026-10-16", null), "آخر عذر: 10 – 16 أكتوبر");
});

test("D6: the course's goal line, to her and about her", () => {
  assert.equal(courseGoalPausedText(true), "لا يُحسب اليوم في هدفكِ، والموعد باقٍ كما هو.");
  assert.equal(courseGoalPausedText(false), "لا يُحسب اليوم في هدفها، والموعد باقٍ كما هو.");
});
