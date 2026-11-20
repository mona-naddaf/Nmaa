import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import { COURSE_GUIDE_SINCE_DEFAULT, courseGuideAllowed, courseGuideListed, courseGuideSince, isNewSince } from "./course-enabled";

// COURSE_GUIDE_EMAILS (the course supervisor's email) and who counts as new.

const saved = { list: process.env.COURSE_GUIDE_EMAILS, since: process.env.COURSE_GUIDE_SINCE };
const set = (list: string | undefined, since?: string) => {
  if (list === undefined) delete process.env.COURSE_GUIDE_EMAILS;
  else process.env.COURSE_GUIDE_EMAILS = list;
  if (since === undefined) delete process.env.COURSE_GUIDE_SINCE;
  else process.env.COURSE_GUIDE_SINCE = since;
};
afterEach(() => set(saved.list, saved.since));

test("unset or empty: no course at all, and nothing is queried", () => {
  set(undefined);
  assert.equal(courseGuideAllowed("sup@example.com"), false);
  assert.equal(courseGuideListed(), false);
  set("  ");
  assert.equal(courseGuideAllowed("sup@example.com"), false);
  assert.equal(courseGuideListed(), false);
});

test("a list: only the listed supervisors, any case; no email = no", () => {
  set("Test.Sup+guide@Example.com, other@x.org");
  assert.equal(courseGuideListed(), true);
  assert.equal(courseGuideAllowed("test.sup+guide@example.com"), true);
  assert.equal(courseGuideAllowed(" TEST.SUP+GUIDE@EXAMPLE.COM "), true);
  assert.equal(courseGuideAllowed("real.course@example.com"), false);
  assert.equal(courseGuideAllowed(null), false);
});

test("«*»: every course", () => {
  set("*");
  assert.equal(courseGuideAllowed("anyone@example.com"), true);
  assert.equal(courseGuideAllowed(null), true);
});

test("new = on or after the start (default, or COURSE_GUIDE_SINCE; a bad value keeps the default)", () => {
  set(undefined);
  assert.equal(courseGuideSince().toISOString(), new Date(COURSE_GUIDE_SINCE_DEFAULT).toISOString());
  const since = courseGuideSince();
  assert.equal(isNewSince(new Date(since.getTime()), since), true);
  assert.equal(isNewSince(new Date(since.getTime() - 1), since), false);
  assert.equal(isNewSince(null, since), false);
  set(undefined, "2027-01-01T00:00:00Z");
  assert.equal(isNewSince(new Date("2026-12-31T23:59:59Z")), false);
  assert.equal(isNewSince(new Date("2027-01-01T00:00:00Z")), true);
  set(undefined, "not a date");
  assert.equal(courseGuideSince().toISOString(), new Date(COURSE_GUIDE_SINCE_DEFAULT).toISOString());
});
