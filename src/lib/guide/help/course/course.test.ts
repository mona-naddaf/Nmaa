import { test } from "node:test";
import assert from "node:assert/strict";
import { STAFF_HELP } from "./staff";
import { STUDENT_HELP } from "./student";
import { PARENT_HELP } from "./parent";
import { courseExcuseHelp, type CourseExcuseViewer } from "./excuse";
import { courseFilled, fillCourse, staffHelpPage, viewerHelpPage, type CourseFill } from "./build";
import { COURSE_PRESS_LABELS, EXCUSE_CARD_LABEL } from "./server-texts";
import { coursePageFor, courseHrefOf } from "./pages";
import { COURSE_ANNOUNCE, COURSE_CHECKLIST, COURSE_LINES } from "../../course-texts";
import { PRESS_LABELS } from "../rafiq/ui";
import { isGuideTarget } from "../targets";
import { genderText, pairsAreWellFormed } from "../text";
import { waitsOn } from "../run";
import type { CourseFeatures, CourseRawPage, StaffFacts, StaffPerm } from "./types";

// The courses' help: the content files, who gets which question, and «أيام
// العذر» reaching only the viewers the feature itself shows it to.

const ALL_ON: CourseFeatures = {
  studentLogin: true,
  studentBoard: true,
  homeLog: true,
  homeMistakes: true,
  assignments: true,
  tracker: true,
  agenda: true,
  summary: true,
  calendar: true,
  online: true,
  board: true,
  studentInfo: true,
  parentInfoEdit: true,
  streak: true,
  review: true,
  tajweed: true,
  similarStaff: true,
  similarStudents: true,
};
const ALL_OFF = Object.fromEntries(Object.keys(ALL_ON).map((k) => [k, false])) as CourseFeatures;
const PERMS_ALL: Record<StaffPerm, boolean> = { add: true, edit: true, archive: true, prior: true, offline: true, plan: true, codes: true, calendarManage: true };
const PERMS_NONE = Object.fromEntries(Object.keys(PERMS_ALL).map((k) => [k, false])) as Record<StaffPerm, boolean>;
const admin: StaffFacts = { role: "admin", perms: PERMS_ALL, features: ALL_ON, students: 3, archived: 0, groups: 2, ownGroups: 0 };
const teacher: StaffFacts = { role: "teacher", perms: PERMS_NONE, features: ALL_ON, students: 3, archived: 0, groups: 2, ownGroups: 1 };
const fillF: CourseFill = { students: "f", sup: "مشرفة الدورة", supOnly: "المشرفة فقط" };
const fillM: CourseFill = { students: "m", sup: "مشرف الدورة", supOnly: "المشرف فقط" };

const allPages = [...STAFF_HELP, ...STUDENT_HELP, ...PARENT_HELP] as CourseRawPage<unknown>[];
const textsOf = (p: CourseRawPage<unknown>) => [
  p.title,
  p.welcome ?? "",
  ...p.questions.flatMap((q) => [q.q, ...(q.notes ?? []), ...q.steps.flatMap((s) => [s.text, s.missing ?? "", s.blocked?.text ?? "", ...(s.options ?? [])])]),
];

test("every text: [f|m] well formed, and nothing of <f|m>/{sup} left once filled", () => {
  for (const p of allPages)
    for (const text of textsOf(p)) {
      assert.ok(pairsAreWellFormed(fillCourse(text, fillF)), `${p.id}: ${text}`);
      for (const fill of [fillF, fillM]) assert.ok(courseFilled(fillCourse(text, fill)), `${p.id}: ${text}`);
      assert.ok(!/كود/.test(text), `«رمز», never «كود»: ${text}`);
    }
  for (const t of [COURSE_ANNOUNCE, COURSE_LINES.needsPerm, COURSE_LINES.off, COURSE_LINES.offer("دخول الطلاب"), COURSE_CHECKLIST.lead, ...Object.values(COURSE_CHECKLIST.items).flatMap((i) => [i.title, i.note])])
    assert.ok(pairsAreWellFormed(fillCourse(t, fillF)) && !/كود/.test(t), t);
});

test("ids unique; every target known; every page has an address or is reached from its list", () => {
  const ids = allPages.flatMap((p) => p.questions.map((q) => q.id));
  assert.equal(new Set(ids).size, ids.length);
  for (const p of allPages)
    for (const q of p.questions)
      for (const s of q.steps) {
        if (s.target) assert.ok(isGuideTarget(s.target), s.target);
        for (const v of s.via ?? []) assert.ok(isGuideTarget(v), v);
      }
  for (const p of allPages) if (!["s.student", "st.segment"].includes(p.id)) assert.ok(courseHrefOf(p.id), p.id);
});

test("every button a tour waits on has its name (course labels, or Rafiq's)", () => {
  const labels = { ...PRESS_LABELS, ...COURSE_PRESS_LABELS, ...EXCUSE_CARD_LABEL } as Record<string, unknown>;
  for (const p of allPages) for (const name of waitsOn(p.questions)) assert.ok(labels[name], `${p.id}: ${name}`);
});

test("«أرِني» never points at nothing: a step on a page with no address is reached by a press first", () => {
  for (const p of allPages)
    for (const q of p.questions) {
      q.steps.forEach((s, i) => {
        if (!s.page || s.page === p.id || courseHrefOf(s.page)) return;
        // the first of its steps there follows a press that opens that page
        if (q.steps[i - 1]?.page === s.page) return;
        assert.equal(q.steps[i - 1]?.kind, "press", `${q.id} step ${i + 1}`);
      });
    }
});

test("paths: each host's pages", () => {
  assert.equal(coursePageFor("staff", "/students"), "s.students");
  assert.equal(coursePageFor("staff", "/students/ckx1"), "s.student");
  assert.equal(coursePageFor("staff", "/students/archive"), "s.archive");
  assert.equal(coursePageFor("staff", "/settings/"), "s.settings");
  assert.equal(coursePageFor("staff", "/rafiq"), null);
  assert.equal(coursePageFor("student", "/student/home-log/abc"), "st.segment");
  assert.equal(coursePageFor("student", "/student/tracker/summary"), "st.summary");
  assert.equal(coursePageFor("parent", "/parent"), "p.home");
  assert.equal(coursePageFor("parent", "/student"), null);
});

const page = (id: string) => STAFF_HELP.find((p) => p.id === id)!;
const q = (built: ReturnType<typeof staffHelpPage>, text: string) => built.questions.find((x) => x.q === text);

test("a teacher without a permission: the question stays, under «أسئلة أخرى», with the supervisor's line (no «أرِني»)", () => {
  const built = staffHelpPage(page("s.students"), teacher, fillF);
  const add = q(built, "كيف أضيف طالبة؟")!;
  assert.equal(add.more, true);
  assert.equal(add.locked, fillCourse(COURSE_LINES.needsPerm, fillF));
  assert.match(genderText(add.locked!, "MALE"), /تحتاج صلاحية من مشرفة الدورة/);
  // with the permission: plain
  const ok = q(staffHelpPage(page("s.students"), { ...teacher, perms: { ...PERMS_NONE, add: true } }, fillF), "كيف أضيف طالبة؟")!;
  assert.equal(ok.locked, undefined);
});

test("supervisor-only questions never reach a teacher; the supervisor has them", () => {
  const forTeacher = staffHelpPage(page("s.settings"), teacher, fillF);
  assert.equal(forTeacher.questions.length, 0);
  assert.ok(staffHelpPage(page("s.settings"), admin, fillF).questions.length > 5);
  assert.equal(q(staffHelpPage(page("s.students"), teacher, fillF), "أين من أرشفتُهم؟"), undefined);
});

test("a feature off: the supervisor gets «تفعيل الآن» to its card; a teacher a line, or nothing", () => {
  const off = { ...ALL_ON, agenda: false, studentLogin: false };
  const a = q(staffHelpPage(page("s.tracker"), { ...admin, features: off }, fillF), "كيف أرتّب البنود وأوقاتها؟")!;
  assert.equal(a.offer?.feature, "card.studentLogin");
  assert.match(a.offer!.text, /«دخول الطلاب»/);
  const t = q(staffHelpPage(page("s.tracker"), { ...teacher, features: off }, fillF), "كيف أرتّب البنود وأوقاتها؟")!;
  assert.equal(t.locked, COURSE_LINES.off);
  assert.equal(t.offer, undefined);
  // hideOff: gone for the teacher
  assert.equal(q(staffHelpPage(page("s.students"), { ...teacher, perms: PERMS_ALL, features: off }, fillF), "أين رموز دخول الطالبات؟"), undefined);
});

test("students and parents: never an offer; a feature off hidden or a line", () => {
  const facts = { features: ALL_OFF, tajweedHers: false };
  for (const raw of STUDENT_HELP) for (const x of viewerHelpPage(raw, facts, fillF).questions) assert.equal(x.offer, undefined);
  const parent = viewerHelpPage(PARENT_HELP[0], { features: ALL_OFF, tajweedHers: false, infoFields: false }, fillM);
  assert.equal(parent.questions.some((x) => /تعديل معلومات/.test(x.q)), false);
  assert.ok(parent.questions.every((x) => !x.offer));
});

test("gender: students by their group, staff by theirs; parents read masculine; the child by her group", () => {
  const st = viewerHelpPage(STUDENT_HELP[0], { features: ALL_ON, tajweedHers: false }, fillF);
  assert.match(genderText(st.questions[0].q, "FEMALE"), /وصلتِ/);
  assert.match(genderText(st.questions[0].q, "MALE"), /وصلتَ/);
  const p = viewerHelpPage(PARENT_HELP[0], { features: ALL_ON, tajweedHers: false, infoFields: true }, fillF);
  assert.equal(genderText(p.questions[0].q, "MALE"), "أين وصلت في الحفظ؟");
  assert.match(genderText(fillCourse(PARENT_HELP[0].welcome!, fillM), "MALE"), /متابعة ابنك:/);
});

// ---------- «أيام العذر» ----------

const EXCUSE_WORDS = /معذور|العذر|عذر/;
const staffV = (over: Partial<Extract<CourseExcuseViewer, { kind: "staff" }>> = {}): CourseExcuseViewer => ({
  kind: "staff",
  admin: true,
  gender: "FEMALE",
  allowed: true,
  on: true,
  girlsGroups: true,
  sees: true,
  itemField: true,
  tracker: true,
  ...over,
});
const count = (h: ReturnType<typeof courseExcuseHelp>) => Object.values(h).reduce((n, qs) => n + (qs?.length ?? 0), 0);

test("excuse: nothing in the shared content files (they reach every viewer)", () => {
  for (const p of allPages) for (const text of textsOf(p)) assert.ok(!EXCUSE_WORDS.test(text), `${p.id}: ${text}`);
  for (const v of Object.values(COURSE_PRESS_LABELS)) assert.ok(!EXCUSE_WORDS.test(typeof v === "string" ? v : v.plain));
});

test("excuse: never staff recorded as male, never without a girls' group, never when not allowed", () => {
  assert.equal(count(courseExcuseHelp(staffV({ gender: "MALE" }))), 0);
  assert.equal(count(courseExcuseHelp(staffV({ gender: "MALE", admin: false }))), 0);
  assert.equal(count(courseExcuseHelp(staffV({ girlsGroups: false }))), 0);
  assert.equal(count(courseExcuseHelp(staffV({ allowed: false }))), 0);
});

test("excuse: the supervisor (a woman or no gender recorded) gets all of it; off: only the settings offer", () => {
  for (const gender of ["FEMALE", null] as const) {
    const h = courseExcuseHelp(staffV({ gender }));
    assert.ok(h["s.settings"] && h["s.students"] && h["s.student"] && h["s.tracker"]);
    assert.ok(h["s.student"]!.some((x) => /وليّ الأمر/.test(x.q)));
  }
  const off = courseExcuseHelp(staffV({ on: false }));
  assert.deepEqual(Object.keys(off), ["s.settings"]);
  assert.equal(off["s.settings"]![0].offer?.feature, "card.excuse");
});

test("excuse: a teacher only where she sees it; no parent question for her; no item field without it", () => {
  assert.equal(count(courseExcuseHelp(staffV({ admin: false, sees: false }))), 0);
  const h = courseExcuseHelp(staffV({ admin: false }));
  assert.equal(h["s.settings"], undefined);
  assert.ok(!h["s.student"]!.some((x) => /وليّ الأمر/.test(x.q)));
  assert.equal(courseExcuseHelp(staffV({ admin: false, itemField: false }))["s.tracker"], undefined);
  assert.equal(courseExcuseHelp(staffV({ admin: false, tracker: false }))["s.tracker"], undefined);
});

test("excuse: a student only in a girls' group with it on; a parent only with «إظهار العذر لوليّ الأمر»", () => {
  assert.equal(count(courseExcuseHelp({ kind: "student", girl: false, allowed: true, on: true, tracker: true })), 0);
  assert.equal(count(courseExcuseHelp({ kind: "student", girl: true, allowed: true, on: false, tracker: true })), 0);
  assert.equal(count(courseExcuseHelp({ kind: "student", girl: true, allowed: true, on: true, tracker: true })), 1);
  assert.equal(count(courseExcuseHelp({ kind: "parent", girl: true, allowed: true, on: true, parentVisible: false })), 0);
  assert.equal(count(courseExcuseHelp({ kind: "parent", girl: false, allowed: true, on: true, parentVisible: true })), 0);
  assert.equal(count(courseExcuseHelp({ kind: "parent", girl: true, allowed: false, on: true, parentVisible: true })), 0);
  assert.equal(count(courseExcuseHelp({ kind: "parent", girl: true, allowed: true, on: true, parentVisible: true })), 1);
});
