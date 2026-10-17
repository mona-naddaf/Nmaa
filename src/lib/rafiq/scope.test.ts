import { test } from "node:test";
import assert from "node:assert/strict";
import { canDeleteSession, recordedByLine, scopeCan, selfAssessed, SELF_SCOPE, type RafiqScope } from "./scope";

const adults = { a1: { name: "سارة", gender: "FEMALE" as const }, a2: { name: "خالد", gender: "MALE" as const } };
const child: RafiqScope = { viewer: "child", adults };
const editor: RafiqScope = { viewer: "adult-edit", subjectId: "c1", child: { name: "ليلى", gender: "FEMALE" }, viewerId: "a1", adults };
const viewer: RafiqScope = { viewer: "adult-view", subjectId: "c2", child: { name: "عمر", gender: "MALE" }, viewerId: "a2", adults };

const own = { source: "LOGGED" as const, recordedByAdult: false, recordedById: null };
const byA1 = { source: "LOGGED" as const, recordedByAdult: true, recordedById: "a1" };
const byA2 = { source: "LOGGED" as const, recordedByAdult: true, recordedById: "a2" };
const byGone = { source: "LOGGED" as const, recordedByAdult: true, recordedById: null };

test("recorded by: nothing on her own Rafiq page or for previous memorization", () => {
  assert.equal(recordedByLine(SELF_SCOPE, byA1, "FEMALE"), null);
  assert.equal(recordedByLine(child, { ...own, source: "PRIOR" }, "MALE"), null);
});

test("recorded by: the child's view, gendered by the child", () => {
  assert.equal(recordedByLine(child, own, "MALE"), "سجّلتَها");
  assert.equal(recordedByLine(child, own, "FEMALE"), "سجّلتِها");
  assert.equal(recordedByLine(child, byA1, "MALE"), "مع سارة");
  assert.equal(recordedByLine(child, byGone, "FEMALE"), "مع أحد البالغين");
});

test("recorded by: an adult's view", () => {
  assert.equal(recordedByLine(editor, own, "FEMALE"), "سجّلتها ليلى");
  assert.equal(recordedByLine(viewer, own, "MALE"), "سجّلها عمر");
  assert.equal(recordedByLine(editor, byA1, "FEMALE"), "سجّلتِها");
  assert.equal(recordedByLine(viewer, byA2, "MALE"), "سجّلتَها");
  assert.equal(recordedByLine(editor, byA2, "FEMALE"), "سجّلها خالد");
  assert.equal(recordedByLine(viewer, byA1, "MALE"), "سجّلتها سارة");
  assert.equal(recordedByLine(editor, byGone, "FEMALE"), "سجّلها أحد البالغين");
});

test("deleting sessions: a child only her own; a view-only adult nothing", () => {
  assert.equal(canDeleteSession(SELF_SCOPE, byA1), true);
  assert.equal(canDeleteSession(child, own), true);
  assert.equal(canDeleteSession(child, byA1), false);
  assert.equal(canDeleteSession(editor, byA1), true);
  assert.equal(canDeleteSession(viewer, own), false);
});

test("self-assessment: the child's own, until an adult changes it", () => {
  const q = { quality: "GOOD", recordedByAdult: false, qualityByAdult: false };
  assert.equal(selfAssessed(child, q), true);
  assert.equal(selfAssessed(editor, q), true);
  assert.equal(selfAssessed(editor, { ...q, qualityByAdult: true }), false);
  assert.equal(selfAssessed(editor, { ...q, recordedByAdult: true }), false);
  assert.equal(selfAssessed(child, { ...q, quality: null }), false);
  // never on her own Rafiq page
  assert.equal(selfAssessed(SELF_SCOPE, q), false);
});

test("what each viewer can do on the page", () => {
  assert.deepEqual(scopeCan(SELF_SCOPE), { record: true, markWords: true, resolve: true, assess: false, ownExtras: true, aboutChild: false });
  assert.deepEqual(scopeCan(child), { record: true, markWords: false, resolve: false, assess: false, ownExtras: false, aboutChild: false });
  assert.deepEqual(scopeCan(editor), { record: true, markWords: true, resolve: true, assess: true, ownExtras: false, aboutChild: true });
  assert.deepEqual(scopeCan(viewer), { record: false, markWords: false, resolve: false, assess: false, ownExtras: false, aboutChild: true });
});
