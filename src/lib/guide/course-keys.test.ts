import { test } from "node:test";
import assert from "node:assert/strict";
import { courseGuideCookie, isCourseGuideKey, readCourseGuide, writeCourseGuide } from "./course-keys";

test("keys: the code's own only", () => {
  assert.equal(isCourseGuideKey("w.s.students"), true);
  assert.equal(isCourseGuideKey("w.st.tracker"), true);
  assert.equal(isCourseGuideKey("w.p.home"), true);
  assert.equal(isCourseGuideKey("ann"), true);
  assert.equal(isCourseGuideKey("cl.hidden"), true);
  assert.equal(isCourseGuideKey("w.s.nowhere"), false);
  assert.equal(isCourseGuideKey("w.rafiq"), false);
  assert.equal(isCourseGuideKey("intro.excuse"), false);
});

test("cookie: round trip, unknown and broken values dropped", () => {
  const v = writeCourseGuide(["w.s.students", "ann", "w.s.students"]);
  assert.deepEqual([...readCourseGuide(v)].sort(), ["ann", "w.s.students"]);
  assert.deepEqual([...readCourseGuide("ann|junk|w.s.x|cl.done")].sort(), ["ann", "cl.done"]);
  assert.equal(readCourseGuide(undefined).size, 0);
  assert.equal(readCourseGuide("%E0%A4%A").size, 0);
});

test("one cookie per person and role", () => {
  assert.equal(courseGuideCookie({ kind: "teacher", id: "ckabc123" }), "cg_t_ckabc123");
  assert.equal(courseGuideCookie({ kind: "parent", id: "ckabc123" }), "cg_p_ckabc123");
  assert.equal(courseGuideCookie({ kind: "student", id: "ckabc123" }), "cg_s_ckabc123");
  assert.notEqual(courseGuideCookie({ kind: "admin", id: "x" }), courseGuideCookie({ kind: "teacher", id: "x" }));
  assert.equal(courseGuideCookie({ kind: "admin", id: "a;b=c" }), "cg_a_abc");
});
